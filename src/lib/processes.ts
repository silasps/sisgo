import { createAdminClient } from '@/lib/supabase/admin'
import type { UnitRef } from '@/lib/staff-loans'

// "Processos" = movimentação de obreiro entre escolas/ministérios que envolve
// mais de uma pessoa decidindo. Junta as duas tabelas que já existiam:
//   • staff_loans (pedido de obreiro): alguém pede um obreiro que já serve em
//     outra unidade → o líder ATUAL dele aceita ou recusa → o DH dá o OK final.
//   • ministry_transfers (envio pelo líder atual, botão "Transferir"): o
//     líder de destino aceita ou recusa → o DH dá o OK final.
// Em qualquer caso a resposta do líder não efetiva nada sozinha: quem fecha
// é sempre o DH, escolhendo o tipo (migration 164) — acúmulo de funções
// (continua na origem e serve também no destino) ou transferência (sai da
// origem). O DH pode decidir a qualquer momento enquanto estiver em andamento.
// Usado pela página /[slug]/processos, pelo card no Início e pelo menu.

type Admin = ReturnType<typeof createAdminClient>

export type ProcessKind = 'emprestimo' | 'transferencia'
export type MoveType = 'acumulo' | 'transferencia'
/** De quem é a vez num processo em andamento. */
export type ProcessStage = 'lider_origem' | 'lider_destino' | 'dh'

export const MOVE_TYPE_LABEL: Record<MoveType, string> = {
  acumulo: 'Acúmulo de funções',
  transferencia: 'Transferência',
}

export type ProcessItem = {
  kind: ProcessKind
  id: string
  status: string
  /** null = já concluído. */
  stage: ProcessStage | null
  statusLabel: string
  moveType: MoveType
  personId: string
  personName: string
  fromUnit: UnitRef
  toUnit: UnitRef
  from: { name: string; href: string }
  to: { name: string; href: string }
  /** Função no destino, por extenso (papel da escola ou nome do ministry_role). */
  role: string | null
  /** ministry_roles.id da função no destino, quando o destino é ministério. */
  toRoleId: string | null
  startsOn: string | null
  endsOn: string | null
  reason: string | null
  /** Observação do líder que respondeu (atual no pedido, destino na transferência). */
  leaderNotes: string | null
  dhNotes: string | null
  requestedBy: string
  requesterName: string
  createdAt: string
  updatedAt: string
}

export const isSameUnit = (a: UnitRef, b: UnitRef) => a.type === b.type && a.id === b.id

export const LOAN_OPEN_STATUSES = ['pendente', 'aceito_origem', 'recusado_origem']
export const TRANSFER_OPEN_STATUSES = ['pendente_destino', 'aceito_destino', 'rejeitado_destino']
const LOAN_CLOSED_STATUSES = ['aprovado', 'rejeitado', 'cancelado']
const TRANSFER_CLOSED_STATUSES = ['efetivado', 'rejeitado_dh', 'cancelado']

const LOAN_STAGE: Record<string, ProcessStage> = { pendente: 'lider_origem', aceito_origem: 'dh', recusado_origem: 'dh' }
const TRANSFER_STAGE: Record<string, ProcessStage> = { pendente_destino: 'lider_destino', aceito_destino: 'dh', rejeitado_destino: 'dh' }

function loanLabel(status: string, decidedByDh: boolean): string {
  switch (status) {
    case 'pendente': return 'Aguardando o líder atual'
    case 'aceito_origem': return 'Líder aceitou — falta o OK do DH'
    case 'recusado_origem': return 'Líder recusou — decisão do DH'
    case 'aprovado': return decidedByDh ? 'Efetivado pelo DH' : 'Aprovado pelo líder'
    case 'rejeitado': return decidedByDh ? 'Encerrado pelo DH' : 'Recusado pelo líder'
    case 'cancelado': return 'Cancelado'
    default: return status
  }
}

const TRANSFER_LABEL: Record<string, string> = {
  pendente_destino: 'Aguardando o líder de destino',
  aceito_destino: 'Destino aceitou — falta o OK do DH',
  rejeitado_destino: 'Destino recusou — decisão do DH',
  efetivado: 'Efetivada pelo DH',
  rejeitado_dh: 'Recusada pelo DH',
  cancelado: 'Cancelada',
}

/**
 * Quem responde pelo DH na base — pros avisos de "processo esperando o DH".
 * Sem ninguém com papel DH, quem decide é o admin da base.
 */
export async function getDhUserIds(orgId: string): Promise<string[]> {
  const sb = createAdminClient()
  const { data: roles } = await sb.from('roles').select('id, name').in('name', ['dh', 'admin_base'])
  const usersWith = async (name: string) => {
    const roleId = roles?.find(r => r.name === name)?.id
    if (!roleId) return []
    const { data } = await sb.from('organization_users').select('user_id')
      .eq('organization_id', orgId).eq('active', true).eq('role_id', roleId)
    return (data ?? []).map(r => r.user_id as string)
  }
  const dh = await usersWith('dh')
  return dh.length > 0 ? dh : usersWith('admin_base')
}

type LoanRaw = {
  id: string; status: string; person_id: string
  from_unit_type: string; from_school_id: string | null; from_ministry_id: string | null
  to_unit_type: string; to_school_id: string | null; to_ministry_id: string | null
  role: string | null; starts_on: string; ends_on: string | null; reason: string | null
  move_type: MoveType; to_ministry_role_id: string | null
  recommendation: string | null; dh_notes: string | null; dh_reviewed_by: string | null
  requested_by: string; created_at: string; updated_at: string
  to_role: { name: string } | null
}

type TransferRaw = {
  id: string; status: string; person_id: string
  from_ministry_id: string; to_ministry_id: string
  reason: string | null; dest_notes: string | null; dh_notes: string | null
  move_type: MoveType
  requested_by: string; created_at: string; updated_at: string
}

const LOAN_COLUMNS = 'id, status, person_id, from_unit_type, from_school_id, from_ministry_id, to_unit_type, to_school_id, to_ministry_id, role, starts_on, ends_on, reason, move_type, to_ministry_role_id, recommendation, dh_notes, dh_reviewed_by, requested_by, created_at, updated_at, to_role:ministry_roles!staff_loans_to_ministry_role_id_fkey(name)'
const TRANSFER_COLUMNS = 'id, status, person_id, from_ministry_id, to_ministry_id, reason, dest_notes, dh_notes, move_type, requested_by, created_at, updated_at'

// Nome de quem pediu: pela pessoa vinculada ao login (staff_profiles); quem
// não tem perfil de obreiro (admin, superadmin) cai no nome do próprio login.
async function userNames(sb: Admin, orgId: string, userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (userIds.length === 0) return names
  const { data } = await sb.from('staff_profiles')
    .select('user_id, people(full_name)')
    .eq('organization_id', orgId).in('user_id', userIds)
  for (const row of (data ?? []) as unknown as Array<{ user_id: string; people: { full_name: string } | null }>) {
    if (row.people?.full_name && !names.has(row.user_id)) names.set(row.user_id, row.people.full_name)
  }
  await Promise.all(userIds.filter(id => !names.has(id)).map(async id => {
    const { data: { user } } = await sb.auth.admin.getUserById(id)
    const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined
    names.set(id, meta?.full_name ?? meta?.name ?? user?.email ?? '—')
  }))
  return names
}

async function buildItems(sb: Admin, orgId: string, slug: string, loans: LoanRaw[], transfers: TransferRaw[]): Promise<ProcessItem[]> {
  const personIds = [...new Set([...loans.map(l => l.person_id), ...transfers.map(t => t.person_id)])]
  const schoolIds = [...new Set(loans.flatMap(l => [l.from_school_id, l.to_school_id]).filter((v): v is string => !!v))]
  const ministryIds = [...new Set([
    ...loans.flatMap(l => [l.from_ministry_id, l.to_ministry_id]),
    ...transfers.flatMap(t => [t.from_ministry_id, t.to_ministry_id]),
  ].filter((v): v is string => !!v))]
  const requesterIds = [...new Set([...loans.map(l => l.requested_by), ...transfers.map(t => t.requested_by)])]

  const [{ data: people }, { data: schools }, { data: ministries }, requesterNames] = await Promise.all([
    personIds.length > 0 ? sb.from('people').select('id, full_name').in('id', personIds) : Promise.resolve({ data: [] }),
    schoolIds.length > 0 ? sb.from('schools').select('id, name').in('id', schoolIds) : Promise.resolve({ data: [] }),
    ministryIds.length > 0 ? sb.from('ministries').select('id, name').in('id', ministryIds) : Promise.resolve({ data: [] }),
    userNames(sb, orgId, requesterIds),
  ])
  const personName = new Map((people ?? []).map(p => [p.id as string, p.full_name as string]))
  const schoolName = new Map((schools ?? []).map(s => [s.id as string, s.name as string]))
  const ministryName = new Map((ministries ?? []).map(m => [m.id as string, m.name as string]))

  const unitRef = (type: string, schoolId: string | null, ministryId: string | null): UnitRef => type === 'school'
    ? { type: 'school', id: schoolId as string }
    : { type: 'ministry', id: ministryId as string }
  const unit = (ref: UnitRef) => ref.type === 'school'
    ? { name: schoolName.get(ref.id) ?? 'Escola', href: `/${slug}/escolas/${ref.id}/equipe` }
    : { name: ministryName.get(ref.id) ?? 'Ministério', href: `/${slug}/ministerios/${ref.id}/equipe` }

  return [
    ...loans.map((l): ProcessItem => {
      const fromUnit = unitRef(l.from_unit_type, l.from_school_id, l.from_ministry_id)
      const toUnit = unitRef(l.to_unit_type, l.to_school_id, l.to_ministry_id)
      return {
        kind: 'emprestimo',
        id: l.id,
        status: l.status,
        stage: LOAN_STAGE[l.status] ?? null,
        statusLabel: loanLabel(l.status, !!l.dh_reviewed_by),
        moveType: l.move_type,
        personId: l.person_id,
        personName: personName.get(l.person_id) ?? '—',
        fromUnit,
        toUnit,
        from: unit(fromUnit),
        to: unit(toUnit),
        role: l.to_unit_type === 'school' ? l.role : (l.to_role?.name ?? null),
        toRoleId: l.to_ministry_role_id,
        startsOn: l.starts_on,
        endsOn: l.ends_on,
        reason: l.reason,
        leaderNotes: l.recommendation,
        dhNotes: l.dh_notes,
        requestedBy: l.requested_by,
        requesterName: requesterNames.get(l.requested_by) ?? '—',
        createdAt: l.created_at,
        updatedAt: l.updated_at,
      }
    }),
    ...transfers.map((t): ProcessItem => {
      const fromUnit: UnitRef = { type: 'ministry', id: t.from_ministry_id }
      const toUnit: UnitRef = { type: 'ministry', id: t.to_ministry_id }
      return {
        kind: 'transferencia',
        id: t.id,
        status: t.status,
        stage: TRANSFER_STAGE[t.status] ?? null,
        statusLabel: TRANSFER_LABEL[t.status] ?? t.status,
        moveType: t.move_type,
        personId: t.person_id,
        personName: personName.get(t.person_id) ?? '—',
        fromUnit,
        toUnit,
        from: unit(fromUnit),
        to: unit(toUnit),
        role: null,
        toRoleId: null,
        startsOn: null,
        endsOn: null,
        reason: t.reason,
        leaderNotes: t.dest_notes,
        dhNotes: t.dh_notes,
        requestedBy: t.requested_by,
        requesterName: requesterNames.get(t.requested_by) ?? '—',
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }
    }),
  ]
}

/** Processos em andamento na base, do mais antigo pro mais novo. */
export async function getOpenProcesses(orgId: string, slug: string): Promise<ProcessItem[]> {
  const sb = createAdminClient()
  const [{ data: loans }, { data: transfers }] = await Promise.all([
    sb.from('staff_loans').select(LOAN_COLUMNS).eq('organization_id', orgId).in('status', LOAN_OPEN_STATUSES),
    sb.from('ministry_transfers').select(TRANSFER_COLUMNS).eq('organization_id', orgId).in('status', TRANSFER_OPEN_STATUSES),
  ])
  const items = await buildItems(sb, orgId, slug, (loans ?? []) as unknown as LoanRaw[], (transfers ?? []) as TransferRaw[])
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Concluídos nos últimos `days` dias, do mais recente pro mais antigo. */
export async function getRecentlyClosedProcesses(orgId: string, slug: string, days = 30, limit = 15): Promise<ProcessItem[]> {
  const sb = createAdminClient()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const [{ data: loans }, { data: transfers }] = await Promise.all([
    sb.from('staff_loans').select(LOAN_COLUMNS).eq('organization_id', orgId).in('status', LOAN_CLOSED_STATUSES)
      .gte('updated_at', since).order('updated_at', { ascending: false }).limit(limit),
    sb.from('ministry_transfers').select(TRANSFER_COLUMNS).eq('organization_id', orgId).in('status', TRANSFER_CLOSED_STATUSES)
      .gte('updated_at', since).order('updated_at', { ascending: false }).limit(limit),
  ])
  const items = await buildItems(sb, orgId, slug, (loans ?? []) as unknown as LoanRaw[], (transfers ?? []) as TransferRaw[])
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit)
}

/** Toda movimentação de uma pessoa (em andamento ou não), da mais recente pra mais antiga. */
export async function getProcessesForPerson(orgId: string, slug: string, personId: string): Promise<ProcessItem[]> {
  const sb = createAdminClient()
  const [{ data: loans }, { data: transfers }] = await Promise.all([
    sb.from('staff_loans').select(LOAN_COLUMNS).eq('organization_id', orgId).eq('person_id', personId),
    sb.from('ministry_transfers').select(TRANSFER_COLUMNS).eq('organization_id', orgId).eq('person_id', personId),
  ])
  const items = await buildItems(sb, orgId, slug, (loans ?? []) as unknown as LoanRaw[], (transfers ?? []) as TransferRaw[])
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Totais pro menu: tudo em andamento e quanto disso espera o DH. */
export async function getProcessCounts(orgId: string): Promise<{ open: number; awaitingDh: number }> {
  const sb = createAdminClient()
  const [{ data: loans }, { data: transfers }] = await Promise.all([
    sb.from('staff_loans').select('status').eq('organization_id', orgId).in('status', LOAN_OPEN_STATUSES),
    sb.from('ministry_transfers').select('status').eq('organization_id', orgId).in('status', TRANSFER_OPEN_STATUSES),
  ])
  const stages = [
    ...(loans ?? []).map(l => LOAN_STAGE[l.status as string]),
    ...(transfers ?? []).map(t => TRANSFER_STAGE[t.status as string]),
  ]
  return { open: stages.length, awaitingDh: stages.filter(s => s === 'dh').length }
}

/**
 * Onde cada pessoa da base já serve, fora de `exclude` — pra avisar no
 * "Solicitar adição" do líder que o pedido vai pro líder dessa unidade. Mesma
 * ordem de findActiveUnit (escola antes de ministério), pra o nome mostrado
 * ser o da unidade que de fato recebe o pedido.
 */
export async function getServingUnitNames(orgId: string, exclude: UnitRef): Promise<Map<string, string>> {
  const sb = createAdminClient()
  const [{ data: schoolRows }, { data: ministryRows }] = await Promise.all([
    sb.from('school_staff').select('person_id, school_id, schools!inner(name, organization_id)')
      .eq('active', true).eq('schools.organization_id', orgId),
    sb.from('ministry_members').select('person_id, ministry_id, ministries!inner(name, organization_id)')
      .eq('active', true).eq('ministries.organization_id', orgId),
  ])
  const map = new Map<string, string>()
  for (const r of (schoolRows ?? []) as unknown as Array<{ person_id: string; school_id: string; schools: { name: string } }>) {
    if (exclude.type === 'school' && r.school_id === exclude.id) continue
    if (!map.has(r.person_id)) map.set(r.person_id, r.schools.name)
  }
  for (const r of (ministryRows ?? []) as unknown as Array<{ person_id: string; ministry_id: string; ministries: { name: string } }>) {
    if (exclude.type === 'ministry' && r.ministry_id === exclude.id) continue
    if (!map.has(r.person_id)) map.set(r.person_id, r.ministries.name)
  }
  return map
}

/** Processos em andamento que envolvem uma escola/ministério (como origem ou destino). */
export async function getOpenProcessesForUnit(orgId: string, slug: string, unit: UnitRef): Promise<ProcessItem[]> {
  const all = await getOpenProcesses(orgId, slug)
  return all.filter(p => isSameUnit(p.fromUnit, unit) || isSameUnit(p.toUnit, unit))
}
