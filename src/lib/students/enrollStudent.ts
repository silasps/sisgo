import { createAdminClient } from '@/lib/supabase/admin'

type EnrollStudentInput = {
  organizationId: string
  personId: string
  classId: string
  acceptedBy?: string | null
  userId?: string | null
}

// Matricula uma pessoa numa turma: garante student_profiles + class_students.
// Reaproveitado tanto pela aprovação manual (DH clica "Aceitar aluno") quanto
// pela matrícula direta automática (formulário de seminário, sem pré-inscrição)
// e pelo import em massa (pessoa já ativa, com login criado no import).
export async function enrollStudent({ organizationId, personId, classId, acceptedBy = null, userId = null }: EnrollStudentInput) {
  const db = createAdminClient()
  const now = new Date().toISOString()

  const { data: existing } = await db.from('student_profiles').select('id, active').eq('person_id', personId).maybeSingle()
  if (!existing) {
    await db.from('student_profiles').insert({
      organization_id: organizationId,
      person_id: personId,
      active: true,
      accepted_by: acceptedBy,
      accepted_at: now,
      ...(userId ? { user_id: userId } : {}),
    })
  } else {
    await db.from('student_profiles')
      .update({ active: true, accepted_by: acceptedBy, accepted_at: now, ...(userId ? { user_id: userId } : {}) })
      .eq('id', existing.id)
  }

  // Marca no histórico da pessoa o início desse período como aluna — só
  // quando não estava ativa antes, pra não duplicar linha numa rematrícula
  // na mesma turma. É o que permite reconhecer, anos depois, que alguém já
  // foi aluna (e desde quando) mesmo após ficar inativa.
  if (!existing?.active) {
    await db.from('person_status_history').insert({
      person_id: personId,
      status: 'aluno',
      started_at: now,
      created_by: acceptedBy,
    })
  }

  await db.from('people').update({ source: null }).eq('id', personId)

  await db.from('class_students').upsert({
    class_id: classId,
    person_id: personId,
    status: 'ativo',
  }, { onConflict: 'class_id,person_id' })
}
