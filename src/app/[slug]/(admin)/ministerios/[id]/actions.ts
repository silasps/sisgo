'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ── DH: cria ministério ──────────────────────────────────────────────────────
export async function createMinistry(orgId: string, name: string, description: string | null) {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('ministries')
    .insert({ organization_id: orgId, name, description })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Erro ao criar ministério')
  await sb.from('ministry_roles').insert([
    { ministry_id: data.id, name: 'Líder' },
    { ministry_id: data.id, name: 'Membro' },
  ])
  return data.id
}

// ── DH: atualiza info do ministério ──────────────────────────────────────────
export async function updateMinistry(
  id: string,
  data: { name?: string; description?: string | null; active?: boolean }
) {
  const sb = createAdminClient()
  await sb
    .from('ministries')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
}

// ── DH: atribui líder (remove anterior, insere novo) ─────────────────────────
export async function assignLeader(orgId: string, ministryId: string, userId: string) {
  const sb = createAdminClient()
  await sb.from('ministry_leaders').delete().eq('ministry_id', ministryId)
  await sb.from('ministry_leaders').insert({ organization_id: orgId, ministry_id: ministryId, user_id: userId })
}

// ── DH: remove líder ─────────────────────────────────────────────────────────
export async function removeLeader(ministryId: string) {
  const sb = createAdminClient()
  await sb.from('ministry_leaders').delete().eq('ministry_id', ministryId)
}

// ── DH: adiciona membro diretamente ──────────────────────────────────────────
export async function addMember(ministryId: string, personId: string, roleId: string | null) {
  const sb = createAdminClient()
  const { data: existing } = await sb
    .from('ministry_members')
    .select('id')
    .eq('ministry_id', ministryId)
    .eq('person_id', personId)
    .single()
  if (existing) {
    await sb.from('ministry_members').update({
      active: true, left_at: null,
      joined_at: new Date().toISOString(),
      ministry_role_id: roleId,
    }).eq('id', existing.id)
  } else {
    await sb.from('ministry_members').insert({
      ministry_id: ministryId, person_id: personId,
      ministry_role_id: roleId,
      joined_at: new Date().toISOString(), active: true,
    })
  }
}

// ── DH: remove membro (soft) ─────────────────────────────────────────────────
export async function removeMember(memberId: string) {
  const sb = createAdminClient()
  await sb.from('ministry_members').update({
    active: false, left_at: new Date().toISOString(),
  }).eq('id', memberId)
}

// ── DH: aprova solicitação e executa a mudança ────────────────────────────────
export async function approveRequest(requestId: string) {
  const sb = createAdminClient()
  const { data: req } = await sb
    .from('ministry_pending_requests')
    .select('*')
    .eq('id', requestId)
    .single()
  if (!req) throw new Error('Solicitação não encontrada')

  if (req.request_type === 'add_member' && req.person_id) {
    await addMember(req.ministry_id, req.person_id, req.ministry_role_id)
  } else if (req.request_type === 'remove_member' && req.person_id) {
    const { data: member } = await sb
      .from('ministry_members')
      .select('id')
      .eq('ministry_id', req.ministry_id)
      .eq('person_id', req.person_id)
      .eq('active', true)
      .single()
    if (member) await removeMember(member.id)
  } else if (req.request_type === 'change_role' && req.person_id && req.ministry_role_id) {
    await sb.from('ministry_members')
      .update({ ministry_role_id: req.ministry_role_id })
      .eq('ministry_id', req.ministry_id)
      .eq('person_id', req.person_id)
      .eq('active', true)
  }

  await sb.from('ministry_pending_requests').update({
    status: 'aprovado',
    reviewed_at: new Date().toISOString(),
  }).eq('id', requestId)
}

// ── DH: rejeita solicitação ───────────────────────────────────────────────────
export async function rejectRequest(requestId: string) {
  const sb = createAdminClient()
  await sb.from('ministry_pending_requests').update({
    status: 'rejeitado',
    reviewed_at: new Date().toISOString(),
  }).eq('id', requestId)
}

// ── Líder: submete solicitação de alteração de membro ────────────────────────
export async function submitMemberRequest(
  orgId: string,
  ministryId: string,
  requestedBy: string,
  requestType: 'add_member' | 'remove_member' | 'change_role',
  personId: string | null,
  roleId: string | null,
  notes: string | null,
) {
  const sb = createAdminClient()
  const { error } = await sb.from('ministry_pending_requests').insert({
    organization_id: orgId,
    ministry_id: ministryId,
    requested_by: requestedBy,
    request_type: requestType,
    person_id: personId,
    ministry_role_id: roleId,
    notes,
  })
  if (error) throw new Error(error.message)
}

// ── Líder: cancela solicitação pendente ──────────────────────────────────────
export async function cancelRequest(requestId: string) {
  const sb = createAdminClient()
  await sb.from('ministry_pending_requests')
    .update({ status: 'cancelado' })
    .eq('id', requestId)
    .eq('status', 'pendente')
}

// ── Líder/ETED: envia solicitação de serviço ──────────────────────────────────
export async function createServiceRequest(
  orgId: string,
  requesterId: string,
  requesterRole: string,
  targetDepartment: string,
  requestType: string,
  subject: string,
  description: string | null,
) {
  const sb = createAdminClient()
  const { error } = await sb.from('service_requests').insert({
    organization_id: orgId,
    requester_id: requesterId,
    requester_role: requesterRole,
    target_department: targetDepartment as 'hospitalidade' | 'dh' | 'secretaria' | 'outro',
    request_type: requestType,
    subject,
    description,
  })
  if (error) throw new Error(error.message)
}

// ── Hospitalidade / gestão: atualiza status de serviço ───────────────────────
export async function updateServiceStatus(requestId: string, status: string) {
  const sb = createAdminClient()
  await sb.from('service_requests').update({
    status: status as 'pendente' | 'em_analise' | 'resolvido' | 'rejeitado',
    reviewed_at: new Date().toISOString(),
  }).eq('id', requestId)
}
