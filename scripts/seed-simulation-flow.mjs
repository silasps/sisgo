import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const content = fs.readFileSync('.env.local', 'utf8')
  for (const line of content.split(/\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

function daysAgo(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

loadEnv()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const batch = `sim45-${new Date().toISOString().slice(0, 19).replace(/\D/g, '')}`
const password = 'Teste@12345'
const manifest = {
  batch,
  created_at: new Date().toISOString(),
  org: null,
  roles: {},
  ministries: [],
  people: [],
  contacts: [],
  auth_users: [],
  organization_users: [],
  staff_profiles: [],
  staff_applications: [],
  ministry_roles: [],
  ministry_leaders: [],
  ministry_members: [],
  ministry_pending_requests: [],
  service_requests: [],
}

async function must(label, promise) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function maybeSingle(label, promise) {
  const { data, error } = await promise
  if (error && error.code !== 'PGRST116') throw new Error(`${label}: ${error.message}`)
  return data ?? null
}

async function getRole(name) {
  const role = await maybeSingle(`role ${name}`, sb.from('roles').select('id, name').eq('name', name).maybeSingle())
  if (!role) throw new Error(`Papel ausente: ${name}`)
  manifest.roles[name] = role.id
  return role.id
}

async function ensureAuthUser(fullName, email, roleId, orgId) {
  const { data: listed } = await sb.auth.admin.listUsers({ perPage: 1000 })
  let authUser = listed.users.find(user => user.email?.toLowerCase() === email)
  if (!authUser) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error || !data.user) throw new Error(`auth ${email}: ${error?.message ?? 'sem usuário'}`)
    authUser = data.user
    manifest.auth_users.push({ id: authUser.id, email })
  }

  const existing = await maybeSingle('organization_user', sb
    .from('organization_users')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', authUser.id)
    .maybeSingle())

  if (existing) {
    await must('update organization_user', sb.from('organization_users').update({ role_id: roleId, active: true }).eq('id', existing.id).select('id').single())
    manifest.organization_users.push({ id: existing.id, user_id: authUser.id, role_id: roleId, reused: true })
  } else {
    const row = await must('insert organization_user', sb.from('organization_users').insert({
      organization_id: orgId,
      user_id: authUser.id,
      role_id: roleId,
      active: true,
    }).select('id, user_id, role_id').single())
    manifest.organization_users.push(row)
  }

  return authUser.id
}

async function createPerson(orgId, fullName, email, phone, createdAt) {
  const person = await must('insert person', sb.from('people').insert({
    organization_id: orgId,
    full_name: fullName,
    source: 'simulacao_45_dias',
    created_at: createdAt,
  }).select('id, full_name').single())
  manifest.people.push(person)

  const contacts = await must('insert contacts', sb.from('person_contacts').insert([
    { person_id: person.id, type: 'email', value: email, is_primary: true },
    { person_id: person.id, type: 'phone', value: phone, is_primary: false },
  ]).select('id, person_id, type, value'))
  manifest.contacts.push(...contacts)
  return person
}

async function createStaffProfile(orgId, personId, userId, ministryName, acceptedAt, acceptedBy = null) {
  const row = await must('insert staff_profile', sb.from('staff_profiles').insert({
    organization_id: orgId,
    person_id: personId,
    role_title: 'Obreiro',
    area: ministryName,
    joined_at: acceptedAt.slice(0, 10),
    active: true,
    user_id: userId,
    accepted_by: acceptedBy,
    accepted_at: acceptedAt,
    created_at: acceptedAt,
  }).select('id, person_id, user_id').single())
  manifest.staff_profiles.push(row)
  return row
}

async function ministryRole(ministryId, name) {
  const existing = await maybeSingle('ministry_role existing', sb
    .from('ministry_roles')
    .select('id, name')
    .eq('ministry_id', ministryId)
    .eq('name', name)
    .maybeSingle())
  if (existing) return existing.id
  const row = await must('insert ministry_role', sb.from('ministry_roles').insert({ ministry_id: ministryId, name }).select('id, name').single())
  manifest.ministry_roles.push({ ...row, ministry_id: ministryId })
  return row.id
}

const ministrySeeds = [
  { name: 'Comunicação - Simulação', leader: 'Helena Comunicação', members: ['Marcos Designer', 'Paula Fotógrafa'] },
  { name: 'Intercessão - Simulação', leader: 'Noemi Intercessão', members: ['Elias Oração', 'Sara Plantão'] },
  { name: 'Louvor - Simulação', leader: 'Rafael Louvor', members: ['Marta Voz', 'Tiago Violão'] },
  { name: 'Manutenção - Simulação', leader: 'Joel Manutenção', members: ['Pedro Ferramentas', 'Lia Reparos'] },
  { name: 'Hospitalidade - Simulação', leader: 'Rebeca Hospitalidade', members: ['Davi Quartos', 'Clara Recepção'] },
  { name: 'Secretaria / Administrativo - Simulação', leader: 'Débora Secretaria', members: ['André Documentos', 'Bianca Atendimento'] },
]

const candidateSeeds = [
  { name: 'Gustavo Candidato', ministryIndex: 0, status: 'pendente', days: 2 },
  { name: 'Larissa Candidata', ministryIndex: 1, status: 'pendente', days: 5 },
  { name: 'Mateus Em Analise', ministryIndex: 2, status: 'em_analise', days: 7 },
  { name: 'Priscila Sem Cadastro', ministryIndex: 3, status: 'em_analise', days: 11 },
  { name: 'Renan Recusado', ministryIndex: 4, status: 'reprovado', days: 17 },
  { name: 'Sofia Cancelada', ministryIndex: 5, status: 'cancelado', days: 21 },
  { name: 'Caio Novo', ministryIndex: 0, status: 'pendente', days: 1 },
  { name: 'Miriam Aguardando DH', ministryIndex: 2, status: 'em_analise', days: 3 },
]

async function main() {
  const org = await must('organization', sb.from('organizations').select('id, name, slug').eq('slug', 'jocum-almirante-tamandare').single())
  manifest.org = org

  const roleIds = {
    dh: await getRole('dh'),
    liderMinisterio: await getRole('lider_ministerio'),
    obreiroMinisterio: await getRole('obreiro_ministerio'),
  }

  const dhName = 'Débora DH Simulação'
  const dhEmail = `${batch}.dh@sisgo.test`
  const dhPerson = await createPerson(org.id, dhName, dhEmail, '+55 41 98888-4500', daysAgo(45))
  const dhUserId = await ensureAuthUser(dhName, dhEmail, roleIds.dh, org.id)
  await createStaffProfile(org.id, dhPerson.id, dhUserId, 'DH', daysAgo(44), dhUserId)

  const ministryRecords = []
  for (let index = 0; index < ministrySeeds.length; index += 1) {
    const seed = ministrySeeds[index]
    const createdAt = daysAgo(43 - index)
    const ministry = await must('insert ministry', sb.from('ministries').insert({
      organization_id: org.id,
      name: seed.name,
      description: `Ministério fictício criado pelo lote ${batch} para simular 45 dias de uso.`,
      active: true,
      created_at: createdAt,
    }).select('id, name').single())
    manifest.ministries.push(ministry)

    const leaderRoleId = await ministryRole(ministry.id, 'Líder')
    const memberRoleId = await ministryRole(ministry.id, 'Membro')
    await ministryRole(ministry.id, 'Coordenador')

    const leaderEmail = `${batch}.${slugify(seed.leader)}@sisgo.test`
    const leaderPerson = await createPerson(org.id, seed.leader, leaderEmail, `+55 41 97777-45${index}0`, daysAgo(42 - index))
    const leaderUserId = await ensureAuthUser(seed.leader, leaderEmail, roleIds.liderMinisterio, org.id)
    await createStaffProfile(org.id, leaderPerson.id, leaderUserId, seed.name, daysAgo(41 - index), dhUserId)

    const leaderLink = await must('insert ministry_leader', sb.from('ministry_leaders').insert({
      organization_id: org.id,
      ministry_id: ministry.id,
      user_id: leaderUserId,
    }).select('id, ministry_id, user_id').single())
    manifest.ministry_leaders.push(leaderLink)

    const leaderMember = await must('insert leader member', sb.from('ministry_members').insert({
      ministry_id: ministry.id,
      person_id: leaderPerson.id,
      ministry_role_id: leaderRoleId,
      active: true,
      joined_at: daysAgo(41 - index).slice(0, 10),
    }).select('id, ministry_id, person_id').single())
    manifest.ministry_members.push(leaderMember)

    const members = []
    for (let memberIndex = 0; memberIndex < seed.members.length; memberIndex += 1) {
      const memberName = seed.members[memberIndex]
      const memberEmail = `${batch}.${slugify(memberName)}@sisgo.test`
      const memberPerson = await createPerson(org.id, memberName, memberEmail, `+55 41 96666-4${index}${memberIndex}0`, daysAgo(38 - index - memberIndex))
      const memberUserId = await ensureAuthUser(memberName, memberEmail, roleIds.obreiroMinisterio, org.id)
      await createStaffProfile(org.id, memberPerson.id, memberUserId, seed.name, daysAgo(37 - index - memberIndex), dhUserId)
      const member = await must('insert ministry_member', sb.from('ministry_members').insert({
        ministry_id: ministry.id,
        person_id: memberPerson.id,
        ministry_role_id: memberRoleId,
        active: true,
        joined_at: daysAgo(37 - index - memberIndex).slice(0, 10),
      }).select('id, ministry_id, person_id').single())
      manifest.ministry_members.push(member)
      members.push({ person: memberPerson, userId: memberUserId })
    }

    ministryRecords.push({ ministry, seed, leaderUserId, leaderPerson, leaderRoleId, memberRoleId, members })
  }

  for (const seed of candidateSeeds) {
    const ministry = ministryRecords[seed.ministryIndex]
    const email = `${batch}.${slugify(seed.name)}@sisgo.test`
    const person = await createPerson(org.id, seed.name, email, `+55 41 95555-${String(seed.days).padStart(4, '0')}`, daysAgo(seed.days))
    const payload = {
      organization_id: org.id,
      person_id: person.id,
      ministry_id: ministry.ministry.id,
      status: seed.status,
      applied_at: daysAgo(seed.days),
      notes: `Candidatura fictícia do lote ${batch}.`,
    }
    if (seed.status === 'em_analise') {
      payload.reviewed_by = ministry.leaderUserId
      payload.reviewed_at = daysAgo(Math.max(seed.days - 1, 0))
      payload.leader_accepted_by = ministry.leaderUserId
      payload.leader_accepted_at = daysAgo(Math.max(seed.days - 1, 0))
    }
    if (seed.status === 'reprovado') {
      payload.reviewed_by = ministry.leaderUserId
      payload.reviewed_at = daysAgo(Math.max(seed.days - 2, 0))
      payload.refusal_reason = 'Perfil ainda não alinhado com a necessidade atual do ministério.'
    }
    const app = await must('insert staff_application', sb.from('staff_applications').insert(payload).select('id, person_id, ministry_id, status').single())
    manifest.staff_applications.push(app)
  }

  const requestPeople = manifest.people.slice(3, 8)
  for (let i = 0; i < 4; i += 1) {
    const ministry = ministryRecords[i]
    const req = await must('insert ministry_pending_request', sb.from('ministry_pending_requests').insert({
      organization_id: org.id,
      ministry_id: ministry.ministry.id,
      requested_by: ministry.leaderUserId,
      request_type: i % 2 === 0 ? 'add_member' : 'change_role',
      person_id: requestPeople[i]?.id ?? null,
      ministry_role_id: i % 2 === 0 ? ministry.memberRoleId : ministry.leaderRoleId,
      notes: `Solicitação fictícia ${i + 1} do lote ${batch}.`,
      status: i === 3 ? 'aprovado' : 'pendente',
      created_at: daysAgo(12 - i),
      reviewed_by: i === 3 ? dhUserId : null,
      reviewed_at: i === 3 ? daysAgo(2) : null,
    }).select('id, ministry_id, request_type, status').single())
    manifest.ministry_pending_requests.push(req)
  }

  const serviceSeeds = [
    ['hospitalidade', 'hospedagem', 'Reservar quartos para professor visitante', 'pendente', 9],
    ['secretaria', 'documentos', 'Emitir declaração para obreiro em viagem', 'em_analise', 6],
    ['dh', 'conversa_pastoral', 'Agendar acompanhamento de equipe', 'pendente', 4],
    ['hospitalidade', 'logistica', 'Organizar transporte para recepção', 'resolvido', 14],
    ['secretaria', 'outro', 'Atualizar dados cadastrais de equipe', 'rejeitado', 20],
  ]
  for (let i = 0; i < serviceSeeds.length; i += 1) {
    const [target, type, subject, status, age] = serviceSeeds[i]
    const requester = ministryRecords[i % ministryRecords.length]
    const service = await must('insert service_request', sb.from('service_requests').insert({
      organization_id: org.id,
      requester_id: requester.leaderUserId,
      requester_role: 'lider_ministerio',
      target_department: target,
      request_type: type,
      subject,
      description: `Solicitação fictícia do lote ${batch}.`,
      status,
      created_at: daysAgo(age),
      reviewed_by: ['resolvido', 'rejeitado'].includes(status) ? dhUserId : null,
      reviewed_at: ['resolvido', 'rejeitado'].includes(status) ? daysAgo(Math.max(age - 3, 0)) : null,
    }).select('id, target_department, request_type, status').single())
    manifest.service_requests.push(service)
  }

  fs.mkdirSync('backups', { recursive: true })
  const path = `backups/simulation-flow-${batch}.json`
  fs.writeFileSync(path, JSON.stringify(manifest, null, 2))
  console.log(JSON.stringify({
    batch,
    password,
    manifest: path,
    counts: {
      ministries: manifest.ministries.length,
      people: manifest.people.length,
      auth_users: manifest.auth_users.length,
      staff_profiles: manifest.staff_profiles.length,
      staff_applications: manifest.staff_applications.length,
      ministry_requests: manifest.ministry_pending_requests.length,
      service_requests: manifest.service_requests.length,
    },
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
