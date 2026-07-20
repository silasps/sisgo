import type { createAdminClient } from '@/lib/supabase/admin'

/** Resolve os IDs das escolas em que a pessoa (usuário aluno) está matriculada. */
export async function getStudentSchoolIds(
  db: ReturnType<typeof createAdminClient>,
  organizationId: string,
  userId: string,
  email: string | null
) {
  const personIds = new Set<string>()

  const { data: profilesByUser, error: profilesByUserError } = await db
    .from('student_profiles')
    .select('person_id, user_id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('active', true)

  if (!profilesByUserError) {
    for (const profile of (profilesByUser ?? []) as Array<{ person_id: string }>) {
      personIds.add(profile.person_id)
    }
  }

  if (email) {
    const { data: contacts } = await db
      .from('person_contacts')
      .select('person_id, people!inner(organization_id)')
      .eq('type', 'email')
      .eq('value', email)
      .eq('people.organization_id', organizationId)

    const contactPersonIds = ((contacts ?? []) as unknown as Array<{ person_id: string }>).map(contact => contact.person_id)

    if (contactPersonIds.length > 0) {
      const { data: activeStudentProfiles } = await db
        .from('student_profiles')
        .select('person_id')
        .eq('organization_id', organizationId)
        .eq('active', true)
        .in('person_id', contactPersonIds)

      for (const profile of (activeStudentProfiles ?? []) as Array<{ person_id: string }>) {
        personIds.add(profile.person_id)
      }
    }
  }

  if (personIds.size === 0) return []

  const personIdList = [...personIds]
  const schoolIds = new Set<string>()

  const { data: enrollments } = await db
    .from('class_students')
    .select('class_id')
    .in('person_id', personIdList)
    .eq('status', 'ativo')

  const classIds = [...new Set(((enrollments ?? []) as Array<{ class_id: string }>).map(row => row.class_id))]

  if (classIds.length > 0) {
    const { data: classes } = await db
      .from('school_classes')
      .select('id, school_id, schools!inner(organization_id)')
      .in('id', classIds)
      .eq('schools.organization_id', organizationId)

    for (const row of (classes ?? []) as unknown as Array<{ school_id: string | null }>) {
      if (row.school_id) schoolIds.add(row.school_id)
    }
  }

  const { data: applications } = await db
    .from('student_applications')
    .select('school_id')
    .eq('organization_id', organizationId)
    .in('person_id', personIdList)
    .eq('status', 'aprovado')

  for (const app of (applications ?? []) as Array<{ school_id: string | null }>) {
    if (app.school_id) schoolIds.add(app.school_id)
  }

  return [...schoolIds]
}
