#!/usr/bin/env node
// Verifica contra o banco real (produção, org jocum-almirante-tamandare) a
// lógica de reconhecimento de pessoa (src/lib/people/resolvePerson.ts) e de
// pré-preenchimento (src/lib/people/getPersonPrefillData.ts), reproduzindo
// aqui os mesmos queries que esses módulos rodam — os scripts deste projeto
// não importam código TS do app (ver scripts/seed-simulation-flow.mjs), só
// replicam a lógica em cima do client JS puro.
//
// Cria pessoas de teste temporárias com o prefixo do batch, roda os 3
// cenários, e apaga tudo no final (sucesso ou falha) — não deixa rastro.
//
// Uso: node scripts/verify-person-recognition.mjs

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const content = fs.readFileSync('.env.local', 'utf8')
  for (const line of content.split(/\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}
loadEnv()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const batch = `verify-${new Date().toISOString().slice(0, 19).replace(/\D/g, '')}`

const created = {
  people: [], person_contacts: [], person_documents: [],
  school_interest_forms: [], school_applications: [],
  staff_applications: [], staff_profiles: [], student_profiles: [],
  class_students: [], person_status_history: [],
}

const results = []
function check(label, condition, detail) {
  const ok = !!condition
  results.push({ label, ok })
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
}

async function must(label, promise) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

// ── Mirrors de src/lib/people/resolvePerson.ts ─────────────────────────────
async function resolvePerson({ organizationId, cpf, email, phone }) {
  let personId = null
  let matchedBy = null

  const cpfDigits = cpf?.replace(/\D/g, '') || null
  if (cpfDigits) {
    const { data } = await sb.from('person_documents')
      .select('person_id, people!inner(organization_id)')
      .eq('type', 'cpf').eq('number', cpfDigits).eq('people.organization_id', organizationId)
      .maybeSingle()
    if (data) { personId = data.person_id; matchedBy = 'cpf' }
  }
  if (!personId && email) {
    const { data } = await sb.from('person_contacts')
      .select('person_id, people!inner(organization_id)')
      .eq('type', 'email').eq('value', email).eq('people.organization_id', organizationId)
      .maybeSingle()
    if (data) { personId = data.person_id; matchedBy = 'email' }
  }
  if (!personId && phone) {
    const { data } = await sb.from('person_contacts')
      .select('person_id, people!inner(organization_id)')
      .eq('type', 'phone').eq('value', phone).eq('people.organization_id', organizationId)
      .maybeSingle()
    if (data) { personId = data.person_id; matchedBy = 'phone' }
  }
  if (!personId) return null

  const [{ data: person }, { data: studentProfile }, { data: staffProfile }] = await Promise.all([
    sb.from('people').select('full_name').eq('id', personId).single(),
    sb.from('student_profiles').select('active').eq('person_id', personId).maybeSingle(),
    sb.from('staff_profiles').select('active, role_title, area, left_at').eq('person_id', personId).maybeSingle(),
  ])
  return { personId, matchedBy, fullName: person?.full_name ?? '', studentProfile, staffProfile }
}

// ── Mirror de src/lib/people/getPersonPrefillData.ts ───────────────────────
function extractPessoais(section) {
  if (!section || typeof section !== 'object') return null
  const s = section
  if (!s.cpf && !s.data_nascimento && !s.sexo && !s.estado_civil) return null
  return { cpf: s.cpf, data_nascimento: s.data_nascimento, sexo: s.sexo, estado_civil: s.estado_civil, celular: s.celular }
}

async function getPersonPrefillData(personId) {
  const { data: staffApp } = await sb.from('staff_applications')
    .select('form_data').eq('person_id', personId)
    .order('applied_at', { ascending: false }).limit(1).maybeSingle()
  const fromStaff = extractPessoais(staffApp?.form_data?.s2)
  if (fromStaff) return fromStaff

  const { data: interestForms } = await sb.from('school_interest_forms').select('id').eq('person_id', personId)
  const interestFormIds = (interestForms ?? []).map(f => f.id)
  if (interestFormIds.length) {
    const { data: schoolApp } = await sb.from('school_applications')
      .select('form_data').in('interest_form_id', interestFormIds)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    const fromSchool = extractPessoais(schoolApp?.form_data?.s5)
    if (fromSchool) return fromSchool
  }

  const [{ data: person }, { data: cpfDoc }, { data: phoneContact }] = await Promise.all([
    sb.from('people').select('birth_date, gender, civil_status').eq('id', personId).maybeSingle(),
    sb.from('person_documents').select('number').eq('person_id', personId).eq('type', 'cpf').maybeSingle(),
    sb.from('person_contacts').select('value').eq('person_id', personId).eq('type', 'phone').maybeSingle(),
  ])
  if (!person?.birth_date && !cpfDoc?.number) return null
  return { cpf: cpfDoc?.number, data_nascimento: person?.birth_date, sexo: person?.gender, estado_civil: person?.civil_status, celular: phoneContact?.value }
}

// ── Mirror de src/lib/people/getCompletedInstitutionSchools.ts ─────────────
function formatMesAno(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

async function getCompletedInstitutionSchools(personId, organizationId) {
  const [{ data: rows }, { data: org }] = await Promise.all([
    sb.from('class_students').select('school_classes(name, ends_at, schools(name))').eq('person_id', personId).eq('status', 'concluido'),
    sb.from('organizations').select('name, country').eq('id', organizationId).maybeSingle(),
  ])
  const base = org?.name ?? ''
  const pais = org?.country === 'BR' ? 'Brasil' : (org?.country ?? '')
  const entries = []
  for (const row of rows ?? []) {
    const escola = row.school_classes?.schools?.name
    if (!escola) continue
    entries.push({ escola, base, pais, mesAno: row.school_classes?.ends_at ? formatMesAno(row.school_classes.ends_at) : '' })
  }
  return entries
}

// ── Mirror de src/lib/students/enrollStudent.ts ────────────────────────────
async function enrollStudent({ organizationId, personId, classId }) {
  const now = new Date().toISOString()
  const { data: existing } = await sb.from('student_profiles').select('id, active').eq('person_id', personId).maybeSingle()
  if (!existing) {
    const row = await must('insert student_profiles', sb.from('student_profiles').insert({
      organization_id: organizationId, person_id: personId, active: true, accepted_at: now,
    }).select('id').single())
    created.student_profiles.push(row.id)
  } else {
    await must('update student_profiles', sb.from('student_profiles').update({ active: true, accepted_at: now }).eq('id', existing.id).select('id').single())
  }
  if (!existing?.active) {
    const row = await must('insert person_status_history', sb.from('person_status_history').insert({
      person_id: personId, status: 'aluno', started_at: now,
    }).select('id').single())
    created.person_status_history.push(row.id)
  }
  await must('upsert class_students', sb.from('class_students').upsert({
    class_id: classId, person_id: personId, status: 'ativo',
  }, { onConflict: 'class_id,person_id' }).select('id').single())
}

async function createPerson(orgId, fullName) {
  const person = await must('insert person', sb.from('people').insert({ organization_id: orgId, full_name: fullName }).select('id').single())
  created.people.push(person.id)
  return person.id
}

async function addContact(personId, type, value, isPrimary = true) {
  const row = await must('insert contact', sb.from('person_contacts').insert({ person_id: personId, type, value, is_primary: isPrimary }).select('id').single())
  created.person_contacts.push(row.id)
}

async function cleanup() {
  const del = async (table, ids, column = 'id') => {
    if (!ids.length) return
    const { error } = await sb.from(table).delete().in(column, ids)
    if (error) console.error(`  ! falha ao limpar ${table}: ${error.message}`)
  }
  await del('person_status_history', created.person_status_history)
  await del('class_students', created.people, 'person_id')
  await del('student_profiles', created.people, 'person_id')
  await del('staff_profiles', created.people, 'person_id')
  await del('staff_applications', created.people, 'person_id')
  await del('school_applications', created.school_applications)
  await del('school_interest_forms', created.school_interest_forms)
  await del('person_documents', created.people, 'person_id')
  await del('person_contacts', created.people, 'person_id')
  await del('people', created.people)
  console.log(`\n🧹 Limpeza concluída (batch ${batch}).`)
}

async function main() {
  const org = await must('organization', sb.from('organizations').select('id').eq('slug', 'jocum-almirante-tamandare').single())
  const klass = await must('class', sb.from('school_classes').select('id, school_id').eq('id', '70981568-5fa9-41a4-8d97-2923a4d76545').single())

  console.log(`Batch: ${batch}\n`)

  // ── Cenário 1: ex-aluna vira obreira — reconhecida + prefill puxado da candidatura de escola
  console.log('── Cenário 1: ex-aluna se candidata a obreira ──')
  const email1 = `${batch}.exaluna@sisgo.test`
  const phone1 = '+5541900000001'
  const person1 = await createPerson(org.id, `[VERIFY] Ex-Aluna ${batch}`)
  await addContact(person1, 'email', email1, true)
  await addContact(person1, 'phone', phone1, false)

  const interestForm1 = await must('insert school_interest_forms', sb.from('school_interest_forms').insert({
    organization_id: org.id, school_id: klass.school_id, class_id: klass.id,
    person_id: person1, full_name: `[VERIFY] Ex-Aluna ${batch}`, email: email1, phone: phone1, status: 'convertido',
  }).select('id').single())
  created.school_interest_forms.push(interestForm1.id)

  const schoolApp1 = await must('insert school_applications', sb.from('school_applications').insert({
    organization_id: org.id, school_id: klass.school_id, class_id: klass.id, interest_form_id: interestForm1.id,
    status: 'aprovado',
    form_data: { s1: { nome: `[VERIFY] Ex-Aluna ${batch}` }, s5: { cpf: '11122233344', data_nascimento: '2000-05-10', sexo: 'F', estado_civil: 'solteiro', celular: phone1, email: email1 } },
  }).select('id').single())
  created.school_applications.push(schoolApp1.id)

  const resolved1 = await resolvePerson({ organizationId: org.id, email: email1 })
  check('resolvePerson acha a ex-aluna pelo email (não cria pessoa nova)', resolved1?.personId === person1, `personId ${resolved1?.personId === person1 ? 'bateu' : 'NÃO bateu'}`)
  check('matchedBy = email', resolved1?.matchedBy === 'email')

  const prefill1 = await getPersonPrefillData(person1)
  check('prefill puxa CPF da candidatura de escola (s5)', prefill1?.cpf === '11122233344', `recebido: ${prefill1?.cpf}`)
  check('prefill puxa data de nascimento', prefill1?.data_nascimento === '2000-05-10', `recebido: ${prefill1?.data_nascimento}`)
  check('prefill puxa sexo/estado civil/celular', prefill1?.sexo === 'F' && prefill1?.estado_civil === 'solteiro' && prefill1?.celular === phone1)

  // ── Cenário 2: obreiro desligado (inativo) volta — reconhecido mesmo inativo + prefill puxado do histórico de obreiro
  console.log('\n── Cenário 2: obreiro desligado há anos volta a se candidatar ──')
  const email2 = `${batch}.exobreiro@sisgo.test`
  const person2 = await createPerson(org.id, `[VERIFY] Ex-Obreiro ${batch}`)
  await addContact(person2, 'email', email2, true)

  const staffApp2 = await must('insert staff_applications', sb.from('staff_applications').insert({
    organization_id: org.id, person_id: person2, status: 'aprovado', applied_at: '2022-01-10T00:00:00Z',
    form_data: { s1: { email: email2 }, s2: { cpf: '22233344455', data_nascimento: '1995-03-20', sexo: 'M', estado_civil: 'casado', celular: '+5541900000002' } },
  }).select('id').single())
  created.staff_applications.push(staffApp2.id)

  const staffProfile2 = await must('insert staff_profiles', sb.from('staff_profiles').insert({
    organization_id: org.id, person_id: person2, role_title: 'Obreiro', active: false, left_at: '2023-01-15',
  }).select('id').single())
  created.staff_profiles.push(staffProfile2.id)

  const resolved2 = await resolvePerson({ organizationId: org.id, email: email2 })
  check('resolvePerson acha o ex-obreiro mesmo com staff_profiles inativo', resolved2?.personId === person2)
  check('retorna staffProfile.active = false (sinal de que já foi obreiro e saiu)', resolved2?.staffProfile?.active === false, `left_at: ${resolved2?.staffProfile?.left_at}`)

  const prefill2 = await getPersonPrefillData(person2)
  check('prefill puxa CPF da candidatura de obreiro anterior (s2)', prefill2?.cpf === '22233344455', `recebido: ${prefill2?.cpf}`)
  check('prefill puxa estado civil/sexo do histórico de obreiro', prefill2?.sexo === 'M' && prefill2?.estado_civil === 'casado')

  // ── Cenário 3: enrollStudent grava person_status_history e não duplica em rematrícula
  console.log('\n── Cenário 3: matrícula grava histórico, sem duplicar em rematrícula ──')
  const person3 = await createPerson(org.id, `[VERIFY] Novo Aluno ${batch}`)

  await enrollStudent({ organizationId: org.id, personId: person3, classId: klass.id })
  const { data: history3a } = await sb.from('person_status_history').select('id, status').eq('person_id', person3)
  check('1ª matrícula cria 1 linha de histórico status=aluno', history3a?.length === 1 && history3a[0]?.status === 'aluno', `linhas: ${history3a?.length}`)

  await enrollStudent({ organizationId: org.id, personId: person3, classId: klass.id })
  const { data: history3b } = await sb.from('person_status_history').select('id').eq('person_id', person3)
  check('rematrícula (já ativa) NÃO duplica linha de histórico', history3b?.length === 1, `linhas: ${history3b?.length}`)

  // ── Cenário 4: ex-aluna com escola concluída nesta instituição — lista de escolas pré-preenchida
  console.log('\n── Cenário 4: escola concluída nesta instituição aparece pré-preenchida ──')
  const person4 = await createPerson(org.id, `[VERIFY] Concluinte ${batch}`)
  await must('insert class_students', sb.from('class_students').insert({
    class_id: klass.id, person_id: person4, status: 'concluido',
  }).select('id').single())

  const escolas4 = await getCompletedInstitutionSchools(person4, org.id)
  check('acha 1 escola concluída nesta instituição', escolas4.length === 1, `recebido: ${escolas4.length}`)
  check('nome da escola bate (DTS)', escolas4[0]?.escola === 'DTS', `recebido: ${escolas4[0]?.escola}`)
  check('base = nome da organização', escolas4[0]?.base === 'JOCUM Almirante Tamandaré', `recebido: ${escolas4[0]?.base}`)
  check('país mapeado de BR para Brasil', escolas4[0]?.pais === 'Brasil', `recebido: ${escolas4[0]?.pais}`)
  check('mês/ano vem do fim da turma (ends_at)', escolas4[0]?.mesAno === '12/2026', `recebido: ${escolas4[0]?.mesAno}`)

  // ── Resumo ──
  const failed = results.filter(r => !r.ok)
  console.log(`\n${failed.length === 0 ? '✅ Todos os' : '❌ ' + failed.length + ' de'} ${results.length} testes ${failed.length === 0 ? 'passaram.' : 'falharam.'}`)
  if (failed.length) {
    console.log('Falhas:', failed.map(f => f.label).join('; '))
    process.exitCode = 1
  }
}

main()
  .catch(error => { console.error('\n💥 Erro durante o teste:', error); process.exitCode = 1 })
  .finally(cleanup)
