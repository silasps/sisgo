'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function assignSchoolLeader(orgId: string, schoolId: string, userId: string) {
  const sb = createAdminClient()
  await sb.from('school_leaders').delete().eq('school_id', schoolId)
  await sb.from('school_leaders').insert({ organization_id: orgId, school_id: schoolId, user_id: userId })
  const { data: role } = await sb.from('roles').select('id').eq('name', 'lider_eted').single()
  if (role) {
    await sb.from('organization_users')
      .update({ role_id: role.id, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('organization_id', orgId)
  }
}

export async function removeSchoolLeader(schoolId: string) {
  const sb = createAdminClient()
  await sb.from('school_leaders').delete().eq('school_id', schoolId)
}

export async function addSchoolStaff(schoolId: string, personId: string, role: string) {
  const sb = createAdminClient()
  const { data: existing } = await sb
    .from('school_staff').select('id').eq('school_id', schoolId).eq('person_id', personId).single()
  if (existing) {
    await sb.from('school_staff').update({ active: true, role, joined_at: new Date().toISOString() }).eq('id', existing.id)
  } else {
    await sb.from('school_staff').insert({ school_id: schoolId, person_id: personId, role })
  }
}

export async function removeSchoolStaff(staffId: string) {
  const sb = createAdminClient()
  await sb.from('school_staff').update({ active: false }).eq('id', staffId)
}

// ── Workflow de solicitação (lider_eted → DH) ─────────────────────────────────

export async function submitSchoolObreiroRequest(
  orgId: string, schoolId: string, requestedBy: string,
  personId: string, role: string, notes: string | null,
) {
  const sb = createAdminClient()
  const { error } = await sb.from('school_pending_requests').insert({
    organization_id: orgId, school_id: schoolId,
    requested_by: requestedBy, person_id: personId, role, notes,
  })
  if (error) throw new Error(error.message)
}

export async function approveSchoolObreiroRequest(requestId: string, reviewedBy: string) {
  const sb = createAdminClient()
  const { data: req } = await sb.from('school_pending_requests').select('*').eq('id', requestId).single()
  if (!req || !req.person_id) throw new Error('Solicitação inválida')
  await addSchoolStaff(req.school_id, req.person_id, req.role)
  await sb.from('school_pending_requests').update({
    status: 'aprovado', reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(),
  }).eq('id', requestId)
}

export async function rejectSchoolObreiroRequest(requestId: string, reviewedBy: string, reviewNotes: string | null) {
  const sb = createAdminClient()
  await sb.from('school_pending_requests').update({
    status: 'rejeitado', reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(), review_notes: reviewNotes,
  }).eq('id', requestId)
}

export async function cancelSchoolObreiroRequest(requestId: string) {
  const sb = createAdminClient()
  await sb.from('school_pending_requests')
    .update({ status: 'cancelado' })
    .eq('id', requestId).eq('status', 'pendente')
}

export async function toggleTurmaActive(classId: string, active: boolean) {
  const sb = createAdminClient()
  await sb.from('school_classes').update({ active: !active }).eq('id', classId)
}

export async function deleteTurma(classId: string) {
  const sb = createAdminClient()
  const { count } = await sb
    .from('school_class_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId)
  if (count && count > 0) throw new Error('Turma possui alunos matriculados.')
  await sb.from('school_classes').delete().eq('id', classId)
}
