'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePersonToUserId } from '@/lib/staff/resolvePersonToUserId'
import { demoteIfNoLeaderships } from '@/lib/staff/demoteIfNoLeaderships'

type AdminClient = ReturnType<typeof createAdminClient>

// Quando um ministério tem `linked_role` (Hospitalidade/Secretaria/DH/Cozinha/
// Manutenção/Comunicação — configurado na criação do ministério) e a pessoa
// ainda está "Pendente de Alocação" (nunca recebeu uma função real), vira-la
// membro desse ministério deve tirá-la desse estado: promove o papel dela na
// base pra o papel vinculado e preenche área/função em staff_profiles. Quem já
// tem um papel real não é mexido — o acesso extra continua vindo dinamicamente
// via ministry_members (ver layout.tsx `linkedRoles`), sem sobrescrever o
// papel principal de quem já está em outra função.
async function promotePendingIfLinkedRole(
  sb: ReturnType<typeof createAdminClient>,
  ministryId: string,
  personId: string,
  ministryRoleId: string | null,
) {
  const { data: ministry } = await sb
    .from('ministries')
    .select('name, linked_role, organization_id')
    .eq('id', ministryId)
    .single()
  if (!ministry?.linked_role) return

  const { data: profile } = await sb
    .from('staff_profiles')
    .select('id, user_id')
    .eq('organization_id', ministry.organization_id)
    .eq('person_id', personId)
    .maybeSingle()
  if (!profile?.user_id) return

  const { data: orgUser } = await sb
    .from('organization_users')
    .select('id, roles(name)')
    .eq('user_id', profile.user_id)
    .eq('organization_id', ministry.organization_id)
    .maybeSingle()
  const currentRoleName = (orgUser?.roles as unknown as { name: string } | null)?.name
  if (!orgUser || currentRoleName !== 'pendente_alocacao') return

  const { data: linkedRole } = await sb
    .from('roles')
    .select('id')
    .eq('name', ministry.linked_role)
    .single()
  if (!linkedRole) return

  let roleTitle: string | null = null
  if (ministryRoleId) {
    const { data: mRole } = await sb.from('ministry_roles').select('name').eq('id', ministryRoleId).single()
    roleTitle = mRole?.name ?? null
  }

  await sb.from('organization_users')
    .update({ role_id: linkedRole.id, updated_at: new Date().toISOString() })
    .eq('id', orgUser.id)

  await sb.from('staff_profiles')
    .update({ area: ministry.name, role_title: roleTitle, updated_at: new Date().toISOString() })
    .eq('id', profile.id)
}

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
  data: {
    name?: string; long_name?: string | null; description?: string | null; active?: boolean
    slug?: string | null; subtitle?: string | null; hero_image_url?: string | null; is_public?: boolean
    description_translations?: Partial<Record<'en' | 'es', string>>
    subtitle_translations?: Partial<Record<'en' | 'es', string>>
  }
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

// ── Atribuição de líder por PESSOA (mesmo padrão de escolas/[id]/actions.ts)
// — busca entre toda a base, não só quem já tem login, e permite colíderes
// (ministry_leaders é unique(ministry_id, user_id), não um líder único por
// ministério). Ao contrário de assignLeader() acima (usado só pra sincronizar
// ministry_leaders quando "líder de ministério" é um PAPEL ACUMULADO, sem
// mexer no papel principal — ver updateExtraRoles em obreiros/actions.ts),
// estas também promovem o papel principal da pessoa pra lider_ministerio,
// igual grantSchoolLeaderRole faz pro lado das escolas. ─────────────────────

async function grantMinistryLeaderRole(sb: AdminClient, orgId: string, ministryId: string, userId: string) {
  const { data: role } = await sb.from('roles').select('id').eq('name', 'lider_ministerio').single()
  if (role) {
    await sb.from('organization_users')
      .update({ role_id: role.id, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('organization_id', orgId)
  }

  const { data: ministry } = await sb.from('ministries').select('name').eq('id', ministryId).single()
  if (ministry) {
    await sb.from('staff_profiles')
      .update({ area: ministry.name, role_title: 'Líder', updated_at: new Date().toISOString() })
      .eq('organization_id', orgId).eq('user_id', userId)
  }
}

// "Atribuir líder" — usado quando o ministério ainda não tem nenhum.
export async function assignMinistryLeader(orgId: string, ministryId: string, userId: string) {
  const sb = createAdminClient()
  const { data: previousLeaders } = await sb.from('ministry_leaders').select('user_id').eq('ministry_id', ministryId)
  await sb.from('ministry_leaders').delete().eq('ministry_id', ministryId)
  await sb.from('ministry_leaders').insert({ organization_id: orgId, ministry_id: ministryId, user_id: userId })
  await grantMinistryLeaderRole(sb, orgId, ministryId, userId)
  for (const prev of previousLeaders ?? []) {
    if (prev.user_id !== userId) await demoteIfNoLeaderships(sb, orgId, prev.user_id)
  }
}

// "Adicionar colíder" — soma à liderança existente em vez de substituir.
export async function addMinistryCoLeader(orgId: string, ministryId: string, userId: string) {
  const sb = createAdminClient()
  const { error } = await sb.from('ministry_leaders').insert({ organization_id: orgId, ministry_id: ministryId, user_id: userId })
  if (error) throw new Error(error.message)
  await grantMinistryLeaderRole(sb, orgId, ministryId, userId)
}

export async function removeMinistryLeader(ministryId: string, userId: string, orgId: string) {
  const sb = createAdminClient()
  await sb.from('ministry_leaders').delete().eq('ministry_id', ministryId).eq('user_id', userId)
  await demoteIfNoLeaderships(sb, orgId, userId)
}

export async function assignMinistryLeaderByPerson(orgId: string, ministryId: string, personId: string): Promise<{ error?: string }> {
  const sb = createAdminClient()
  const resolved = await resolvePersonToUserId(sb, orgId, personId, 'lider_ministerio')
  if ('error' in resolved) return resolved
  await assignMinistryLeader(orgId, ministryId, resolved.userId)
  return {}
}

export async function addMinistryCoLeaderByPerson(orgId: string, ministryId: string, personId: string): Promise<{ error?: string }> {
  const sb = createAdminClient()
  const resolved = await resolvePersonToUserId(sb, orgId, personId, 'lider_ministerio')
  if ('error' in resolved) return resolved
  await addMinistryCoLeader(orgId, ministryId, resolved.userId)
  return {}
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

  await promotePendingIfLinkedRole(sb, ministryId, personId, roleId)
}

// ── DH: adiciona membro só se a pessoa não estiver ativa em outra escola/
// ministério da mesma organização — se estiver, vira um pedido de obreiro
// (staff_loans) pro líder atual responder e o DH dar o OK final em Processos
// (ver src/lib/staff-loans.ts). ───────────────────────────────────────────────
export async function addMemberChecked(params: {
  orgId: string; ministryId: string; personId: string; roleId: string | null
  requestedBy: string; moveType: 'acumulo' | 'transferencia'; startsOn: string; endsOn: string | null
}): Promise<'added' | 'pending_loan'> {
  const { findActiveUnit, createStaffLoan } = await import('@/lib/staff-loans')
  const from = await findActiveUnit(params.orgId, params.personId, { type: 'ministry', id: params.ministryId })
  if (!from) {
    await addMember(params.ministryId, params.personId, params.roleId)
    return 'added'
  }
  await createStaffLoan({
    orgId: params.orgId, personId: params.personId, from, to: { type: 'ministry', id: params.ministryId },
    role: null, ministryRoleId: params.roleId, moveType: params.moveType,
    requestedBy: params.requestedBy, startsOn: params.startsOn, endsOn: params.endsOn,
  })
  return 'pending_loan'
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
export async function updateServiceStatus(requestId: string, status: string, reviewedBy: string, resolutionNotes?: string | null) {
  const sb = createAdminClient()
  await sb.from('service_requests').update({
    status: status as 'pendente' | 'em_analise' | 'em_andamento' | 'resolvido' | 'rejeitado',
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    ...(resolutionNotes !== undefined ? { resolution_notes: resolutionNotes } : {}),
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

// Em andamento: a resposta do líder de destino (aceitou ou recusou) não
// encerra nada — quem dá o OK final, a qualquer momento, é o DH (migration 164).
const TRANSFER_OPEN_STATUSES = ['pendente_destino', 'aceito_destino', 'rejeitado_destino']

// Push best-effort (mesmo esquema de lib/staff-loans.ts) — quem não tem o app
// vê na equipe do ministério ou em Processos.
async function notifyTransfer(
  sb: AdminClient,
  transferId: string,
  event: 'pedida' | 'respondida',
  actorId: string,
) {
  try {
    const { data: t } = await sb.from('ministry_transfers')
      .select('organization_id, person_id, from_ministry_id, to_ministry_id, status, requested_by')
      .eq('id', transferId).single()
    if (!t) return
    const [{ data: org }, { data: person }, { data: units }] = await Promise.all([
      sb.from('organizations').select('slug').eq('id', t.organization_id).single(),
      sb.from('people').select('full_name').eq('id', t.person_id).single(),
      sb.from('ministries').select('id, name').in('id', [t.from_ministry_id, t.to_ministry_id]),
    ])
    const nameOf = (id: string) => units?.find(u => u.id === id)?.name ?? 'outro ministério'
    const personName = person?.full_name ?? 'Obreiro'
    const { sendPushToUsers } = await import('@/lib/notifications/push')
    const send = (userIds: string[], title: string, body: string, url: string) =>
      sendPushToUsers([...new Set(userIds)].filter(id => id !== actorId), { title, body, data: { url } })

    if (event === 'pedida') {
      const { data: leaders } = await sb.from('ministry_leaders').select('user_id').eq('ministry_id', t.to_ministry_id)
      await send((leaders ?? []).map(l => l.user_id as string), 'Transferência de obreiro',
        `${personName}, de ${nameOf(t.from_ministry_id)}, foi indicado(a) para ${nameOf(t.to_ministry_id)}. Responda na equipe.`,
        `/${org?.slug}/ministerios/${t.to_ministry_id}/equipe`)
    } else {
      const { getDhUserIds } = await import('@/lib/processes')
      const verbo = t.status === 'aceito_destino' ? 'aceitou' : 'recusou'
      await send([...(await getDhUserIds(t.organization_id)), t.requested_by as string], 'Processo aguardando o DH',
        `O líder de ${nameOf(t.to_ministry_id)} ${verbo} a transferência de ${personName}. Falta o OK final do DH.`,
        `/${org?.slug}/processos`)
    }
  } catch {
    // aviso é best-effort
  }
}

export async function requestTransfer(data: {
  organizationId: string
  personId: string
  fromMinistryId: string
  toMinistryId: string
  requestedBy: string
  reason: string | null
}) {
  const sb = createAdminClient()
  const { data: row, error } = await sb.from('ministry_transfers').insert({
    organization_id:  data.organizationId,
    person_id:        data.personId,
    from_ministry_id: data.fromMinistryId,
    to_ministry_id:   data.toMinistryId,
    requested_by:     data.requestedBy,
    reason:           data.reason,
  }).select('id').single()
  if (error) throw new Error(error.message)
  await notifyTransfer(sb, row.id, 'pedida', data.requestedBy)
}

export async function respondTransferAsDestination(
  transferId: string,
  userId: string,
  accept: boolean,
  notes: string | null,
) {
  const sb = createAdminClient()
  const { data, error } = await sb.from('ministry_transfers').update({
    status:           accept ? 'aceito_destino' : 'rejeitado_destino',
    dest_reviewed_by: userId,
    dest_reviewed_at: new Date().toISOString(),
    dest_notes:       notes,
    updated_at:       new Date().toISOString(),
  }).eq('id', transferId).eq('status', 'pendente_destino').select('id').maybeSingle()
  if (error) throw new Error(error.message)
  if (data) await notifyTransfer(sb, transferId, 'respondida', userId)
}

// OK final do DH, chamado de /processos. `config` é o que o DH escolheu no
// card de configuração: tipo (transferência tira da origem; acúmulo mantém) e
// função no ministério de destino. Sem config, mantém o comportamento antigo:
// transferência como "Membro". O UPDATE condicional "reserva" a transferência
// antes de mexer nos vínculos — duas decisões ao mesmo tempo não efetivam duas vezes.
export async function confirmTransferAsDH(
  transferId: string,
  userId: string,
  confirm: boolean,
  notes: string | null,
  config?: { moveType: 'acumulo' | 'transferencia'; ministryRoleId: string | null },
) {
  const sb = createAdminClient()
  const now = new Date().toISOString()

  if (!confirm) {
    const { data } = await sb.from('ministry_transfers').update({
      status:         'rejeitado_dh',
      dh_reviewed_by: userId,
      dh_reviewed_at: now,
      dh_notes:       notes,
      updated_at:     now,
    }).eq('id', transferId).in('status', TRANSFER_OPEN_STATUSES).select('id').maybeSingle()
    if (!data) throw new Error('Transferência não encontrada ou já concluída.')
    return
  }

  const moveType = config?.moveType === 'acumulo' ? 'acumulo' : 'transferencia'
  const { data: transfer } = await sb.from('ministry_transfers').update({
    status:         'efetivado',
    move_type:      moveType,
    dh_reviewed_by: userId,
    dh_reviewed_at: now,
    dh_notes:       notes,
    effective_date: now.slice(0, 10),
    updated_at:     now,
  }).eq('id', transferId).in('status', TRANSFER_OPEN_STATUSES).select('*').maybeSingle()
  if (!transfer) throw new Error('Transferência não encontrada ou já concluída.')

  let roleId = config ? config.ministryRoleId : null
  if (!config) {
    const { data: defaultRole } = await sb.from('ministry_roles')
      .select('id').eq('ministry_id', transfer.to_ministry_id).eq('name', 'Membro').maybeSingle()
    roleId = defaultRole?.id ?? null
  }
  await addMember(transfer.to_ministry_id, transfer.person_id, roleId)

  if (moveType === 'acumulo') return

  // Lista, não single(): registro nunca é apagado, então pode haver mais de um.
  const { data: currentMembers } = await sb.from('ministry_members')
    .select('id')
    .eq('ministry_id', transfer.from_ministry_id)
    .eq('person_id', transfer.person_id)
    .eq('active', true)
  for (const m of currentMembers ?? []) await removeMember(m.id)

  const { data: destMinistry } = await sb.from('ministries')
    .select('name')
    .eq('id', transfer.to_ministry_id)
    .single()
  if (destMinistry) {
    await sb.from('staff_profiles')
      .update({ area: destMinistry.name, updated_at: now })
      .eq('person_id', transfer.person_id)
      .eq('organization_id', transfer.organization_id)
  }
}

export async function cancelTransfer(transferId: string, userId: string) {
  const sb = createAdminClient()
  await sb.from('ministry_transfers')
    .update({ status: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', transferId)
    .eq('requested_by', userId)
    .in('status', TRANSFER_OPEN_STATUSES)
}

// ── Líder/DH: envia formulário definitivo de obreiro direto, sem pré-inscrição
// pública prévia (a pessoa já conversou com o líder fora do sistema) ────────
export async function inviteStaffMemberDirect(data: {
  slug: string
  organizationId: string
  ministryId: string
  fullName: string
  email: string | null
  phone: string | null
  message: string | null
  createdBy: string | null
}) {
  const { sendDirectStaffInvite } = await import('@/lib/staff/staffApplicationInvite')
  return sendDirectStaffInvite({
    slug: data.slug,
    organizationId: data.organizationId,
    ministryId: data.ministryId,
    schoolId: null,
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    message: data.message,
    createdBy: data.createdBy,
  })
}
