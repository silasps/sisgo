'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/notifications/push'
import { getDhUserIds, type MoveType } from '@/lib/processes'

export type UnitRef = { type: 'school'; id: string } | { type: 'ministry'; id: string }

type Admin = ReturnType<typeof createAdminClient>

type LoanRow = {
  id: string
  organization_id: string
  person_id: string
  from_unit_type: 'school' | 'ministry'
  from_school_id: string | null
  from_ministry_id: string | null
  to_unit_type: 'school' | 'ministry'
  to_school_id: string | null
  to_ministry_id: string | null
  to_ministry_role_id: string | null
  role: string | null
  move_type: MoveType
  requested_by: string
}

// Em andamento: o DH pode dar o OK final em qualquer um desses estados — a
// resposta do líder atual ('aceito_origem'/'recusado_origem') só informa a
// decisão dele, não efetiva nada (migration 164).
const OPEN_STATUSES = ['pendente', 'aceito_origem', 'recusado_origem']

const fromUnitOf = (l: LoanRow): UnitRef =>
  l.from_unit_type === 'school' ? { type: 'school', id: l.from_school_id as string } : { type: 'ministry', id: l.from_ministry_id as string }
const toUnitOf = (l: LoanRow): UnitRef =>
  l.to_unit_type === 'school' ? { type: 'school', id: l.to_school_id as string } : { type: 'ministry', id: l.to_ministry_id as string }

const asMoveType = (v: string | null | undefined): MoveType => (v === 'transferencia' ? 'transferencia' : 'acumulo')

// Escola OU ministério onde a pessoa já serve ativamente, se houver algum
// diferente da unidade de destino (`exclude`) — usado pra decidir se
// adicionar em outro lugar é direto ou vira pedido pro líder atual (ver
// addSchoolStaffChecked/addMemberChecked nos respectivos actions.ts).
export async function findActiveUnit(orgId: string, personId: string, exclude: UnitRef): Promise<UnitRef | null> {
  const sb = createAdminClient()
  const [{ data: schoolRows }, { data: ministryRows }] = await Promise.all([
    sb.from('school_staff').select('school_id, schools(organization_id)').eq('person_id', personId).eq('active', true),
    sb.from('ministry_members').select('ministry_id, ministries(organization_id)').eq('person_id', personId).eq('active', true),
  ])
  for (const r of (schoolRows ?? []) as unknown as Array<{ school_id: string; schools: { organization_id: string } | null }>) {
    if (r.schools?.organization_id === orgId && !(exclude.type === 'school' && r.school_id === exclude.id)) {
      return { type: 'school', id: r.school_id }
    }
  }
  for (const r of (ministryRows ?? []) as unknown as Array<{ ministry_id: string; ministries: { organization_id: string } | null }>) {
    if (r.ministries?.organization_id === orgId && !(exclude.type === 'ministry' && r.ministry_id === exclude.id)) {
      return { type: 'ministry', id: r.ministry_id }
    }
  }
  return null
}

export async function createStaffLoan(params: {
  orgId: string
  personId: string
  from: UnitRef
  to: UnitRef
  role: string | null
  requestedBy: string
  moveType: MoveType
  startsOn: string
  /** Só no acúmulo, e opcional (sem prazo); transferência não tem fim. */
  endsOn: string | null
  reason?: string | null
  ministryRoleId?: string | null
}) {
  const sb = createAdminClient()
  // Já tem pedido em andamento dessa pessoa pra essa unidade (clique duplo,
  // líder e DH pedindo a mesma pessoa): não duplica nem avisa de novo.
  const { data: existing } = await sb.from('staff_loans').select('id')
    .eq('person_id', params.personId).in('status', OPEN_STATUSES)
    .eq(params.to.type === 'school' ? 'to_school_id' : 'to_ministry_id', params.to.id)
    .limit(1).maybeSingle()
  if (existing) return

  const { data: loan, error } = await sb.from('staff_loans').insert({
    organization_id: params.orgId,
    person_id: params.personId,
    from_unit_type: params.from.type,
    from_school_id: params.from.type === 'school' ? params.from.id : null,
    from_ministry_id: params.from.type === 'ministry' ? params.from.id : null,
    to_unit_type: params.to.type,
    to_school_id: params.to.type === 'school' ? params.to.id : null,
    to_ministry_id: params.to.type === 'ministry' ? params.to.id : null,
    to_ministry_role_id: params.to.type === 'ministry' ? (params.ministryRoleId ?? null) : null,
    role: params.role,
    move_type: params.moveType,
    starts_on: params.startsOn,
    ends_on: params.moveType === 'acumulo' ? params.endsOn : null,
    reason: params.reason ?? null,
    requested_by: params.requestedBy,
  }).select('*').single()
  if (error) throw new Error(error.message)
  await notifyLoan(sb, loan as LoanRow, 'criado', params.requestedBy)
}

// Pedido de obreiro feito pelo LÍDER na tela da equipe. Se a pessoa já serve
// em outra escola/ministério, vira pedido pro líder de lá responder e pro DH
// dar o OK final (com o tipo que o líder escolheu: acúmulo ou transferência);
// senão segue como sempre: solicitação ao DH.
export async function requestStaffForUnit(params: {
  orgId: string
  to: UnitRef
  personId: string
  requestedBy: string
  /** Escola: papel em texto livre (school_staff.role). */
  role: string | null
  /** Ministério: ministry_roles.id. */
  ministryRoleId: string | null
  notes: string | null
  moveType: MoveType
  startsOn: string | null
  endsOn: string | null
}): Promise<'pending_loan' | 'sent_to_dh' | 'invalid_period'> {
  const from = await findActiveUnit(params.orgId, params.personId, params.to)
  if (from) {
    const startsOn = params.startsOn || new Date().toISOString().slice(0, 10)
    if (params.moveType === 'acumulo' && params.endsOn && params.endsOn < startsOn) return 'invalid_period'
    await createStaffLoan({
      orgId: params.orgId, personId: params.personId, from, to: params.to,
      role: params.to.type === 'school' ? (params.role ?? 'Obreiro') : null,
      ministryRoleId: params.ministryRoleId,
      requestedBy: params.requestedBy,
      moveType: params.moveType,
      startsOn,
      endsOn: params.endsOn,
      reason: params.notes,
    })
    return 'pending_loan'
  }

  if (params.to.type === 'ministry') {
    const { submitMemberRequest } = await import('@/app/[slug]/(admin)/ministerios/[id]/actions')
    await submitMemberRequest(params.orgId, params.to.id, params.requestedBy, 'add_member', params.personId, params.ministryRoleId, params.notes)
  } else {
    const { submitSchoolObreiroRequest } = await import('@/app/[slug]/(admin)/escolas/[id]/actions')
    await submitSchoolObreiroRequest(params.orgId, params.to.id, params.requestedBy, params.personId, params.role ?? 'Obreiro', params.notes)
  }
  return 'sent_to_dh'
}

// Resposta do líder ATUAL — chamadas das telas de equipe (escolas/[id]/equipe,
// ministerios/[id]/equipe). Nenhuma das duas efetiva: só registra a posição
// dele e passa pro DH dar o OK final. Cada transição de status é um UPDATE
// condicional ao status atual: se o DH já decidiu, a resposta do líder não
// vale mais e ele recebe "já respondido".

export async function approveStaffLoan(loanId: string, reviewerId: string, recommendation: string | null) {
  const sb = createAdminClient()
  const { data: loan } = await sb.from('staff_loans')
    .update({ status: 'aceito_origem', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), recommendation })
    .eq('id', loanId).eq('status', 'pendente')
    .select('*').maybeSingle()
  if (!loan) throw new Error('Pedido não encontrado ou já respondido.')
  await notifyLoan(sb, loan as LoanRow, 'aceito_origem', reviewerId)
}

export async function rejectStaffLoan(loanId: string, reviewerId: string, recommendation: string | null) {
  const sb = createAdminClient()
  const { data: loan } = await sb.from('staff_loans')
    .update({ status: 'recusado_origem', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), recommendation })
    .eq('id', loanId).eq('status', 'pendente')
    .select('*').maybeSingle()
  if (!loan) throw new Error('Pedido não encontrado ou já respondido.')
  await notifyLoan(sb, loan as LoanRow, 'recusado_origem', reviewerId)
}

// OK final do DH — a qualquer momento enquanto o pedido estiver em andamento,
// inclusive antes de o líder atual responder. Chamada de /processos, onde o
// DH configura como a pessoa vai servir (tipo, função no destino e período);
// o que ele escolher substitui o que foi pedido.
export async function decideStaffLoanAsDH(
  loanId: string,
  dhUserId: string,
  approve: boolean,
  notes: string | null,
  config?: {
    moveType: MoveType
    /** Destino ministério: ministry_roles.id (null = sem papel específico). */
    ministryRoleId: string | null
    /** Destino escola: papel em texto livre. */
    role: string | null
    startsOn: string | null
    endsOn: string | null
  },
) {
  const sb = createAdminClient()
  const moveType = config ? asMoveType(config.moveType) : null
  const startsOn = config?.startsOn || new Date().toISOString().slice(0, 10)
  if (approve && moveType === 'acumulo' && config?.endsOn && config.endsOn < startsOn) {
    throw new Error('A data final do acúmulo é antes da data de início.')
  }

  const { data: current } = await sb.from('staff_loans').select('to_unit_type').eq('id', loanId).maybeSingle()
  const configFields = approve && config && moveType ? {
    move_type: moveType,
    starts_on: startsOn,
    ends_on: moveType === 'acumulo' ? (config.endsOn || null) : null,
    ...(current?.to_unit_type === 'school'
      ? { role: config.role?.trim() || 'Obreiro' }
      : { to_ministry_role_id: config.ministryRoleId || null }),
  } : {}

  const { data: loan } = await sb.from('staff_loans')
    .update({
      status: approve ? 'aprovado' : 'rejeitado',
      dh_reviewed_by: dhUserId,
      dh_reviewed_at: new Date().toISOString(),
      dh_notes: notes,
      ...configFields,
    })
    .eq('id', loanId).in('status', OPEN_STATUSES)
    .select('*').maybeSingle()
  if (!loan) throw new Error('Processo não encontrado ou já concluído.')
  if (approve) await effectLoan(sb, loan as LoanRow)
  await notifyLoan(sb, loan as LoanRow, approve ? 'efetivado_dh' : 'encerrado_dh', dhUserId)
}

// Quem pediu desiste enquanto ainda está em andamento.
export async function cancelStaffLoan(loanId: string, userId: string) {
  const sb = createAdminClient()
  await sb.from('staff_loans')
    .update({ status: 'cancelado' })
    .eq('id', loanId).eq('requested_by', userId).in('status', OPEN_STATUSES)
}

// Coloca a pessoa no destino; na transferência, também tira da origem (soft:
// active=false, nada é apagado) e a área dela no Quadro de Obreiros passa a
// ser o destino — mesmo efeito de confirmTransferAsDH pros ministérios.
async function effectLoan(sb: Admin, loan: LoanRow) {
  const [escolas, ministerios] = await Promise.all([
    import('@/app/[slug]/(admin)/escolas/[id]/actions'),
    import('@/app/[slug]/(admin)/ministerios/[id]/actions'),
  ])
  if (loan.to_unit_type === 'school') {
    await escolas.addSchoolStaff(loan.to_school_id as string, loan.person_id, loan.role ?? 'Obreiro')
  } else {
    await ministerios.addMember(loan.to_ministry_id as string, loan.person_id, loan.to_ministry_role_id)
  }
  if (loan.move_type !== 'transferencia') return

  if (loan.from_unit_type === 'school') {
    const { data: rows } = await sb.from('school_staff').select('id')
      .eq('school_id', loan.from_school_id as string).eq('person_id', loan.person_id).eq('active', true)
    for (const r of rows ?? []) await escolas.removeSchoolStaff(r.id as string)
  } else {
    const { data: rows } = await sb.from('ministry_members').select('id')
      .eq('ministry_id', loan.from_ministry_id as string).eq('person_id', loan.person_id).eq('active', true)
    for (const r of rows ?? []) await ministerios.removeMember(r.id as string)
  }

  const { data: dest } = loan.to_unit_type === 'school'
    ? await sb.from('schools').select('name').eq('id', loan.to_school_id as string).maybeSingle()
    : await sb.from('ministries').select('name').eq('id', loan.to_ministry_id as string).maybeSingle()
  if (dest?.name) {
    await sb.from('staff_profiles')
      .update({ area: dest.name, updated_at: new Date().toISOString() })
      .eq('person_id', loan.person_id).eq('organization_id', loan.organization_id)
  }
}

// ── Avisos (push nativo direto, mesmo esquema de lib/reservations.ts) ─────────
// Best-effort: chamados depois da mudança de status, nunca derrubam a ação —
// quem não tem o app instalado vê o pedido na tela (Pendências/Processos).

type LoanEvent = 'criado' | 'aceito_origem' | 'recusado_origem' | 'efetivado_dh' | 'encerrado_dh'

async function unitInfo(sb: Admin, unit: UnitRef, slug: string) {
  const [{ data: row }, { data: leaders }] = unit.type === 'school'
    ? await Promise.all([
      sb.from('schools').select('name').eq('id', unit.id).maybeSingle(),
      sb.from('school_leaders').select('user_id').eq('school_id', unit.id),
    ])
    : await Promise.all([
      sb.from('ministries').select('name').eq('id', unit.id).maybeSingle(),
      sb.from('ministry_leaders').select('user_id').eq('ministry_id', unit.id),
    ])
  return {
    name: row?.name ?? (unit.type === 'school' ? 'a escola' : 'o ministério'),
    leaderIds: (leaders ?? []).map(l => l.user_id as string),
    href: `/${slug}/${unit.type === 'school' ? 'escolas' : 'ministerios'}/${unit.id}/equipe`,
  }
}

async function notifyLoan(sb: Admin, loan: LoanRow, event: LoanEvent, actorId: string) {
  try {
    const [{ data: org }, { data: person }] = await Promise.all([
      sb.from('organizations').select('slug').eq('id', loan.organization_id).single(),
      sb.from('people').select('full_name').eq('id', loan.person_id).single(),
    ])
    const slug = org?.slug as string
    const personName = person?.full_name ?? 'Obreiro'
    const [from, to] = await Promise.all([unitInfo(sb, fromUnitOf(loan), slug), unitInfo(sb, toUnitOf(loan), slug)])
    const processosHref = `/${slug}/processos`
    const tipo = loan.move_type === 'transferencia' ? 'transferência' : 'acúmulo de funções'

    const send = (userIds: string[], title: string, body: string, url: string) =>
      sendPushToUsers([...new Set(userIds)].filter(id => id !== actorId), { title, body, data: { url } })

    switch (event) {
      case 'criado':
        await send(from.leaderIds, 'Pedido de obreiro',
          `${personName} foi pedido(a) para ${to.name} (${tipo}). Responda na equipe de ${from.name}.`, from.href)
        break
      case 'aceito_origem':
      case 'recusado_origem': {
        const verbo = event === 'aceito_origem' ? 'aceitou' : 'recusou'
        await send(await getDhUserIds(loan.organization_id), 'Processo aguardando o DH',
          `O líder de ${from.name} ${verbo} o pedido de ${personName} para ${to.name}. Falta o OK final do DH.`, processosHref)
        await send([loan.requested_by], `Líder ${verbo} o pedido`,
          `O líder de ${from.name} ${verbo} o pedido de ${personName}. Agora o DH dá o OK final.`, to.href)
        break
      }
      case 'efetivado_dh':
        await send([loan.requested_by, ...from.leaderIds], 'Pedido de obreiro efetivado pelo DH',
          loan.move_type === 'transferencia'
            ? `${personName} foi transferido(a) de ${from.name} para ${to.name}.`
            : `${personName} continua em ${from.name} e passa a servir também em ${to.name}.`, to.href)
        break
      case 'encerrado_dh':
        await send([loan.requested_by, ...from.leaderIds], 'Pedido de obreiro encerrado pelo DH',
          `O pedido de ${personName} para ${to.name} foi encerrado.`, to.href)
        break
    }
  } catch {
    // aviso é best-effort
  }
}
