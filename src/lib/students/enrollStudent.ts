import { createAdminClient } from '@/lib/supabase/admin'

type EnrollStudentInput = {
  organizationId: string
  personId: string
  classId: string
  acceptedBy?: string | null
}

// Matricula uma pessoa numa turma: garante student_profiles + class_students.
// Reaproveitado tanto pela aprovação manual (DH clica "Aceitar aluno") quanto
// pela matrícula direta automática (formulário de seminário, sem pré-inscrição).
export async function enrollStudent({ organizationId, personId, classId, acceptedBy = null }: EnrollStudentInput) {
  const db = createAdminClient()
  const now = new Date().toISOString()

  const { data: existing } = await db.from('student_profiles').select('id').eq('person_id', personId).maybeSingle()
  if (!existing) {
    await db.from('student_profiles').insert({
      organization_id: organizationId,
      person_id: personId,
      active: true,
      accepted_by: acceptedBy,
      accepted_at: now,
    })
  } else {
    await db.from('student_profiles')
      .update({ active: true, accepted_by: acceptedBy, accepted_at: now })
      .eq('id', existing.id)
  }

  await db.from('people').update({ source: null }).eq('id', personId)

  await db.from('class_students').upsert({
    class_id: classId,
    person_id: personId,
    status: 'ativo',
  }, { onConflict: 'class_id,person_id' })
}
