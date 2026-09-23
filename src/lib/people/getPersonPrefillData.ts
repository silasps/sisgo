import { createAdminClient } from '@/lib/supabase/admin'

export type PersonalDataPrefill = {
  cpf?: string
  data_nascimento?: string
  sexo?: string
  estado_civil?: string
  celular?: string
}

function extractPessoais(section: unknown): PersonalDataPrefill | null {
  if (!section || typeof section !== 'object') return null
  const s = section as Record<string, string>
  if (!s.cpf && !s.data_nascimento && !s.sexo && !s.estado_civil) return null
  return { cpf: s.cpf, data_nascimento: s.data_nascimento, sexo: s.sexo, estado_civil: s.estado_civil, celular: s.celular }
}

// Busca os dados pessoais mais completos já conhecidos de uma pessoa, no
// mesmo formato de chave usado pelas seções "dados pessoais" dos formulários
// (s2 do obreiro / s5 do aluno — mesmas chaves, ver FormularioObreiro.tsx,
// FormularioInscricao.tsx e o mapeamento equivalente em
// src/lib/import-pessoas/createPerson.ts). Prioriza a candidatura mais
// recente que já tenha esses dados preenchidos (obreiro, depois aluno) e só
// cai pros campos estruturados de people/person_documents (caso de quem
// entrou via import) se nenhuma candidatura tiver nada.
export async function getPersonPrefillData(personId: string): Promise<PersonalDataPrefill | null> {
  const db = createAdminClient()

  const { data: staffApp } = await db.from('staff_applications')
    .select('form_data')
    .eq('person_id', personId)
    .order('applied_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const fromStaff = extractPessoais((staffApp?.form_data as Record<string, unknown> | null)?.s2)
  if (fromStaff) return fromStaff

  const { data: interestForms } = await db.from('school_interest_forms').select('id').eq('person_id', personId)
  const interestFormIds = (interestForms ?? []).map(f => f.id)
  if (interestFormIds.length) {
    const { data: schoolApp } = await db.from('school_applications')
      .select('form_data')
      .in('interest_form_id', interestFormIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const fromSchool = extractPessoais((schoolApp?.form_data as Record<string, unknown> | null)?.s5)
    if (fromSchool) return fromSchool
  }

  const [{ data: person }, { data: cpfDoc }, { data: phoneContact }] = await Promise.all([
    db.from('people').select('birth_date, gender, civil_status').eq('id', personId).maybeSingle(),
    db.from('person_documents').select('number').eq('person_id', personId).eq('type', 'cpf').maybeSingle(),
    db.from('person_contacts').select('value').eq('person_id', personId).eq('type', 'phone').maybeSingle(),
  ])
  if (!person?.birth_date && !cpfDoc?.number) return null

  return {
    cpf: cpfDoc?.number,
    data_nascimento: person?.birth_date ?? undefined,
    sexo: person?.gender ?? undefined,
    estado_civil: person?.civil_status ?? undefined,
    celular: phoneContact?.value,
  }
}
