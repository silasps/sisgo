import { createAdminClient } from '@/lib/supabase/admin'

type ResolvePersonParams = {
  organizationId: string
  cpf?: string | null
  email?: string | null
  phone?: string | null
}

export type ResolvedPerson = {
  personId: string
  matchedBy: 'cpf' | 'email' | 'phone'
  fullName: string
  studentProfile: { active: boolean } | null
  staffProfile: { active: boolean; roleTitle: string | null; area: string | null; leftAt: string | null } | null
}

// Acha uma pessoa já cadastrada na organização por CPF, email ou telefone
// (nessa ordem — CPF muda menos que contato ao longo dos anos). Usado em todo
// fluxo que hoje criaria uma `people` nova (pré-inscrição, convite direto,
// import) pra reconhecer quem já passou pelo sistema antes, mesmo que tenha
// ficado inativa por muito tempo (student_profiles/staff_profiles inativos
// ainda contam como match).
export async function resolvePerson({ organizationId, cpf, email, phone }: ResolvePersonParams): Promise<ResolvedPerson | null> {
  const db = createAdminClient()

  let personId: string | null = null
  let matchedBy: ResolvedPerson['matchedBy'] | null = null

  const cpfDigits = cpf?.replace(/\D/g, '') || null
  if (cpfDigits) {
    const { data } = await db.from('person_documents')
      .select('person_id, people!inner(organization_id)')
      .eq('type', 'cpf').eq('number', cpfDigits).eq('people.organization_id', organizationId)
      .maybeSingle()
    if (data) { personId = data.person_id; matchedBy = 'cpf' }
  }

  if (!personId && email) {
    const { data } = await db.from('person_contacts')
      .select('person_id, people!inner(organization_id)')
      .eq('type', 'email').eq('value', email).eq('people.organization_id', organizationId)
      .maybeSingle()
    if (data) { personId = data.person_id; matchedBy = 'email' }
  }

  if (!personId && phone) {
    const { data } = await db.from('person_contacts')
      .select('person_id, people!inner(organization_id)')
      .eq('type', 'phone').eq('value', phone).eq('people.organization_id', organizationId)
      .maybeSingle()
    if (data) { personId = data.person_id; matchedBy = 'phone' }
  }

  if (!personId || !matchedBy) return null

  const [{ data: person }, { data: studentProfile }, { data: staffProfile }] = await Promise.all([
    db.from('people').select('full_name').eq('id', personId).single(),
    db.from('student_profiles').select('active').eq('person_id', personId).maybeSingle(),
    db.from('staff_profiles').select('active, role_title, area, left_at').eq('person_id', personId).maybeSingle(),
  ])

  return {
    personId,
    matchedBy,
    fullName: person?.full_name ?? '',
    studentProfile: studentProfile ? { active: studentProfile.active } : null,
    staffProfile: staffProfile
      ? { active: staffProfile.active, roleTitle: staffProfile.role_title, area: staffProfile.area, leftAt: staffProfile.left_at }
      : null,
  }
}
