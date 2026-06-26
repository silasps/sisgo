'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ── DH: cria ministério ──────────────────────────────────────────────────────
export async function createMinistry(orgId: string, name: string, description: string | null, linkedRole?: string | null) {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('ministries')
    .insert({ organization_id: orgId, name, description, linked_role: linkedRole || null })
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
export async function updateServiceStatus(requestId: string, status: string, reviewedBy: string) {
  const sb = createAdminClient()
  await sb.from('service_requests').update({
    status: status as 'pendente' | 'em_analise' | 'em_andamento' | 'resolvido' | 'rejeitado',
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  }).eq('id', requestId)
}

// ── Assumir solicitação de serviço ───────────────────────────────────────────
export async function assignServiceRequest(requestId: string, userId: string) {
  const sb = createAdminClient()
  await sb.from('service_requests').update({
    assigned_to: userId,
    status: 'em_analise',
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', requestId)
}

// ── Redirecionar solicitação de "outro" para departamento específico ─────────
export async function redirectServiceRequest(requestId: string, newDepartment: string, reviewedBy: string) {
  const sb = createAdminClient()
  const { data: req } = await sb.from('service_requests')
    .select('target_department')
    .eq('id', requestId)
    .single()
  if (!req) throw new Error('Solicitação não encontrada')

  await sb.from('service_requests').update({
    target_department: newDepartment,
    redirected_from: req.target_department,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  }).eq('id', requestId)
}

// ── Transferência de obreiro entre ministérios ───────────────────────────────

export async function requestTransfer(data: {
  organizationId: string
  personId: string
  fromMinistryId: string
  toMinistryId: string
  requestedBy: string
  reason: string | null
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('ministry_transfers').insert({
    organization_id:  data.organizationId,
    person_id:        data.personId,
    from_ministry_id: data.fromMinistryId,
    to_ministry_id:   data.toMinistryId,
    requested_by:     data.requestedBy,
    reason:           data.reason,
  })
  if (error) throw new Error(error.message)
}

export async function respondTransferAsDestination(
  transferId: string,
  userId: string,
  accept: boolean,
  notes: string | null,
) {
  const sb = createAdminClient()
  const { error } = await sb.from('ministry_transfers').update({
    status:           accept ? 'aceito_destino' : 'rejeitado_destino',
    dest_reviewed_by: userId,
    dest_reviewed_at: new Date().toISOString(),
    dest_notes:       notes,
    updated_at:       new Date().toISOString(),
  }).eq('id', transferId).eq('status', 'pendente_destino')
  if (error) throw new Error(error.message)
}

export async function confirmTransferAsDH(
  transferId: string,
  userId: string,
  confirm: boolean,
  notes: string | null,
) {
  const sb = createAdminClient()

  if (!confirm) {
    await sb.from('ministry_transfers').update({
      status:         'rejeitado_dh',
      dh_reviewed_by: userId,
      dh_reviewed_at: new Date().toISOString(),
      dh_notes:       notes,
      updated_at:     new Date().toISOString(),
    }).eq('id', transferId).eq('status', 'aceito_destino')
    return
  }

  const { data: transfer } = await sb.from('ministry_transfers')
    .select('*')
    .eq('id', transferId)
    .eq('status', 'aceito_destino')
    .single()
  if (!transfer) throw new Error('Transferência não encontrada')

  const { data: currentMember } = await sb.from('ministry_members')
    .select('id')
    .eq('ministry_id', transfer.from_ministry_id)
    .eq('person_id', transfer.person_id)
    .eq('active', true)
    .single()
  if (currentMember) await removeMember(currentMember.id)

  const { data: defaultRole } = await sb.from('ministry_roles')
    .select('id')
    .eq('ministry_id', transfer.to_ministry_id)
    .eq('name', 'Membro')
    .single()
  await addMember(transfer.to_ministry_id, transfer.person_id, defaultRole?.id ?? null)

  const { data: destMinistry } = await sb.from('ministries')
    .select('name')
    .eq('id', transfer.to_ministry_id)
    .single()
  if (destMinistry) {
    await sb.from('staff_profiles')
      .update({ area: destMinistry.name, updated_at: new Date().toISOString() })
      .eq('person_id', transfer.person_id)
      .eq('organization_id', transfer.organization_id)
  }

  const today = new Date().toISOString().split('T')[0]
  await sb.from('ministry_transfers').update({
    status:         'efetivado',
    dh_reviewed_by: userId,
    dh_reviewed_at: new Date().toISOString(),
    dh_notes:       notes,
    effective_date: today,
    updated_at:     new Date().toISOString(),
  }).eq('id', transferId)
}

export async function cancelTransfer(transferId: string, userId: string) {
  const sb = createAdminClient()
  await sb.from('ministry_transfers')
    .update({ status: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', transferId)
    .eq('requested_by', userId)
    .in('status', ['pendente_destino', 'aceito_destino'])
}
