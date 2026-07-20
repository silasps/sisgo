import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppShell } from '@/components/layout/AppShell'
import { SuperAdminContextBar } from '@/components/layout/SuperAdminContextBar'
import { notFound, redirect } from 'next/navigation'
import { accentCssVars } from '@/lib/accent-colors'
import { getRolePreview } from '@/lib/role-preview'
import { getNavMode } from '@/lib/nav-mode'
import { asLooseClient } from '@/lib/supabase/loose-client'
import { FeedbackButton } from '@/components/layout/FeedbackButton'
import { isManagementRole, isGeneralFinanceRole, MANUTENCAO_ROLES, HOSPEDAGEM_ROLES, userHasAnyRole } from '@/lib/auth/permissions'
import { Toaster } from 'sonner'
import { Suspense } from 'react'
import { FlashToast } from '@/components/ui/FlashToast'
import { PushNotificationManager } from '@/components/PushNotificationManager'
import type { BottomBarItem } from '@/components/layout/BottomNav'

type RegularNavItem = { href: string; label: string; icon: string; alert?: boolean }
type DividerNavItem  = { divider: true; label: string }
type NavItem = RegularNavItem | DividerNavItem

const PESSOAL_DIVIDER: DividerNavItem = { divider: true, label: 'Pessoal' }
const PESSOAL_ICONS   = new Set(['refeicoes', 'contas', 'carteirinha', 'minha-lavanderia'])

function addPersonalSplit(items: RegularNavItem[], personalIcons = PESSOAL_ICONS): NavItem[] {
  const op   = items.filter(i => !personalIcons.has(i.icon))
  const pers = items.filter(i =>  personalIcons.has(i.icon))
  if (pers.length === 0) return op
  return [...op, PESSOAL_DIVIDER, ...pers]
}

// ── Modo Pessoal x Administração ────────────────────────────────────────────
// Itens "universais" aparecem nos dois modos; o resto do navItems final (que já
// passou por addPersonalSplit) é dividido pela posição do divisor "Pessoal".
const UNIVERSAL_ICONS = new Set(['dashboard', 'calendario', 'pendentes', 'solicitacoes'])

function splitNavByMode(navItems: NavItem[]) {
  const dividerIdx = navItems.findIndex(i => 'divider' in i)
  const before = (dividerIdx === -1 ? navItems : navItems.slice(0, dividerIdx)) as RegularNavItem[]
  const personal = (dividerIdx === -1 ? [] : navItems.slice(dividerIdx + 1)) as RegularNavItem[]
  const universal = before.filter(i => UNIVERSAL_ICONS.has(i.icon))
  const admin = before.filter(i => !UNIVERSAL_ICONS.has(i.icon))
  return { universal, admin, personal }
}

const NAV_SECTION_BY_ICON: Record<string, string> = {
  pessoas: 'Pessoas & Times', presenca: 'Pessoas & Times', obreiros: 'Pessoas & Times',
  escolas: 'Pessoas & Times', inscricoes: 'Pessoas & Times', ministerios: 'Pessoas & Times',
  reservas: 'Hospedagem', hospedagem: 'Hospedagem', quartos: 'Hospedagem', agenda: 'Hospedagem', lavanderia: 'Hospedagem',
  cozinha: 'Cozinha', estoque: 'Cozinha', receitas: 'Cozinha',
  'estoque-manutencao': 'Manutenção',
  financeiro: 'Financeiro', caixa: 'Financeiro',
  configuracoes: 'Configurações',
}

function sectionize(items: RegularNavItem[]): NavItem[] {
  const out: NavItem[] = []
  let lastSection: string | null = null
  for (const item of items) {
    const section = NAV_SECTION_BY_ICON[item.icon] ?? null
    if (section && section !== lastSection) out.push({ divider: true, label: section })
    lastSection = section
    out.push(item)
  }
  return out
}

// Tela "Ver tudo": mostra TUDO que o papel tem acesso, independente do modo atual.
function buildAllAppsItems(universal: RegularNavItem[], admin: RegularNavItem[], personal: RegularNavItem[]): NavItem[] {
  const out: NavItem[] = []
  if (universal.length) out.push({ divider: true, label: 'Visão geral' }, ...universal)
  out.push(...sectionize(admin))
  if (personal.length) out.push({ divider: true, label: 'Pessoal' }, ...personal)
  return out
}

// Remove divisores de seção que ficaram sem nenhum item depois de um filtro.
function dropEmptySections(items: NavItem[]): NavItem[] {
  const out: NavItem[] = []
  let pendingDivider: NavItem | null = null
  for (const item of items) {
    if ('divider' in item) { pendingDivider = item; continue }
    if (pendingDivider) { out.push(pendingDivider); pendingDivider = null }
    out.push(item)
  }
  return out
}

function buildNav(slug: string, role: string, accumulatedRoles: string[], hasPending: boolean, hasReservationsPending: boolean, hasOwnCashScope: boolean, laundryEnabled: boolean, hasMinistryMessages: boolean, hasSchoolMessages: boolean, idCardEnabled: boolean): NavItem[] {
  const allRoles = [role, ...accumulatedRoles]
  const is = (r: string) => allRoles.includes(r)
  const isManagement        = isManagementRole(role)
  const isLiderMinisterio   = is('lider_ministerio')
  const isObreiroMinisterio = is('obreiro_ministerio')
  const isObreiroEted       = is('obreiro_eted')
  const isAluno             = is('aluno')
  const isAssociado         = is('associado')
  const isHospitalidade     = is('hospitalidade')
  const isCozinha           = is('cozinha')
  const isManutencao        = is('manutencao')
  const canSeeGeneralFinance = isGeneralFinanceRole(role) || accumulatedRoles.some(r => isGeneralFinanceRole(r))
  const canSeeManutencao    = userHasAnyRole(allRoles, MANUTENCAO_ROLES)
  const canSeeHospedagem    = userHasAnyRole(allRoles, HOSPEDAGEM_ROLES)
  const canBuyMeals         = true
  const canSeeReservas      = isManagement || isHospitalidade || is('lider_eted') || isObreiroEted || isAluno || isAssociado || isLiderMinisterio || isObreiroMinisterio

  type AllItem = RegularNavItem & { show: boolean }
  const toItem = (i: AllItem): RegularNavItem => ({ href: i.href, label: i.label, icon: i.icon, alert: i.alert })
  const pick = (...ends: string[]) => (i: AllItem) => ends.some(e => i.href.endsWith(e))

  const all: AllItem[] = [
    { href: `/${slug}/dashboard`,    label: 'Início',           icon: 'dashboard',     show: true },
    { href: `/${slug}/calendario`,   label: 'Calendário',       icon: 'calendario',    show: true },
    { href: `/${slug}/pendentes`,    label: 'Pendentes',        icon: 'pendentes',     show: true, alert: hasPending },
    { href: `/${slug}/comunicacao`,  label: 'Comunicação',      icon: 'comunicacao',   show: role === 'lider_base' || role === 'superadmin' || is('comunicacao') },
    { href: `/${slug}/pessoas`,      label: 'Pessoas',          icon: 'pessoas',       show: !is('lider_eted') && !isLiderMinisterio },
    { href: `/${slug}/presenca`,     label: 'Presença',         icon: 'presenca',      show: isManagement || is('secretaria') || is('hospitalidade') || isCozinha || is('lider_eted') || isObreiroEted || isLiderMinisterio || isObreiroMinisterio },
    { href: `/${slug}/obreiros`,     label: 'Obreiros',         icon: 'obreiros',      show: isManagement },
    { href: `/${slug}/escolas`,      label: 'Escolas',          icon: 'escolas',       show: isManagement || is('lider_eted') || isObreiroEted, alert: hasSchoolMessages },
    { href: `/${slug}/inscricoes`,   label: 'Inscrições',       icon: 'inscricoes',    show: isManagement || is('lider_eted') || isLiderMinisterio },
    { href: `/${slug}/ministerios`,  label: 'Ministérios',      icon: 'ministerios',   show: isManagement || isLiderMinisterio || isObreiroMinisterio || isHospitalidade || isCozinha || isManutencao || is('secretaria'), alert: hasMinistryMessages },
    { href: `/${slug}/reservas`,     label: 'Reservas',         icon: 'reservas',      show: canSeeReservas, alert: hasReservationsPending },
    { href: `/${slug}/hospedagem`,   label: 'Hospedagem',       icon: 'hospedagem',    show: canSeeHospedagem },
    { href: `/${slug}/hospedagem/quartos`, label: 'Quartos',    icon: 'quartos',       show: canSeeHospedagem },
    { href: `/${slug}/hospedagem/agenda`,  label: 'Agenda',     icon: 'agenda',        show: canSeeHospedagem },
    { href: `/${slug}/hospedagem/lavanderia`, label: 'Lavanderia', icon: 'lavanderia', show: canSeeHospedagem && laundryEnabled },
    { href: `/${slug}/refeicoes`,    label: 'Minhas refeições', icon: 'refeicoes',     show: canBuyMeals },
    { href: `/${slug}/cozinha`,      label: 'Cozinha',          icon: 'cozinha',       show: isManagement || is('secretaria') || isCozinha },
    { href: `/${slug}/cozinha/estoque`, label: 'Estoque',       icon: 'estoque',       show: isManagement || is('secretaria') || isCozinha },
    { href: `/${slug}/cozinha/receitas`, label: 'Receitas',     icon: 'receitas',      show: isManagement || is('secretaria') || isCozinha },
    { href: `/${slug}/manutencao`,   label: 'Solicitações',     icon: 'solicitacoes',  show: true },
    { href: `/${slug}/manutencao/estoque`, label: 'Est. Manutenção', icon: 'estoque-manutencao', show: canSeeManutencao },
    { href: `/${slug}/financeiro`,   label: 'Financeiro',       icon: 'financeiro',    show: canSeeGeneralFinance },
    { href: `/${slug}/caixa`,        label: 'Caixa da área',    icon: 'caixa',         show: hasOwnCashScope },
    { href: `/${slug}/minhas-contas`, label: 'Minhas Contas',   icon: 'contas',        show: true },
    { href: `/${slug}/minha-lavanderia`, label: 'Lavanderia',   icon: 'minha-lavanderia', show: laundryEnabled },
    { href: `/${slug}/minha-carteirinha`, label: 'Minha Carteirinha', icon: 'carteirinha', show: idCardEnabled },
    { href: `/${slug}/configuracoes`, label: 'Configurações',   icon: 'configuracoes', show: isManagement },
  ]

  const dropDisabledCard = (items: AllItem[]) => items.filter(i => i.icon !== 'carteirinha' || idCardEnabled)

  if (isHospitalidade) {
    return addPersonalSplit(dropDisabledCard(all.filter(pick('/dashboard', '/calendario', '/pendentes', '/presenca', '/pessoas', '/reservas', '/hospedagem', '/hospedagem/quartos', '/hospedagem/agenda', '/hospedagem/lavanderia', '/ministerios', '/manutencao', '/refeicoes', '/minhas-contas', '/minha-lavanderia', '/minha-carteirinha'))).map(toItem))
  }

  if (isCozinha) {
    return addPersonalSplit(dropDisabledCard(all.filter(pick('/dashboard', '/calendario', '/pendentes', '/cozinha', '/cozinha/estoque', '/cozinha/receitas', '/ministerios', '/manutencao', '/refeicoes', '/minhas-contas', '/minha-lavanderia', '/minha-carteirinha'))).map(toItem))
  }

  if (isManutencao) {
    return addPersonalSplit(dropDisabledCard(all.filter(pick('/dashboard', '/calendario', '/pendentes', '/manutencao', '/manutencao/estoque', '/ministerios', '/refeicoes', '/minhas-contas', '/minha-lavanderia', '/minha-carteirinha'))).map(toItem))
  }

  if (isObreiroMinisterio) {
    return addPersonalSplit(dropDisabledCard(all.filter(pick('/dashboard', '/calendario', '/pendentes', '/presenca', '/ministerios', '/reservas', '/manutencao', '/refeicoes', '/minhas-contas', '/minha-lavanderia', '/minha-carteirinha'))).map(toItem))
  }

  if (isObreiroEted) {
    return addPersonalSplit(dropDisabledCard(all.filter(pick('/dashboard', '/calendario', '/pendentes', '/presenca', '/escolas', '/reservas', '/manutencao', '/refeicoes', '/minhas-contas', '/minha-lavanderia', '/minha-carteirinha'))).map(toItem))
  }

  if (isAluno || isAssociado) {
    return addPersonalSplit(
      dropDisabledCard(all.filter(pick('/dashboard', '/calendario', '/pendentes', '/reservas', '/manutencao', '/refeicoes', '/minhas-contas', '/minha-lavanderia', '/minha-carteirinha'))).map(toItem),
      new Set(['reservas', 'refeicoes', 'contas', 'carteirinha', 'minha-lavanderia']),
    )
  }

  return addPersonalSplit(all.filter(i => i.show).map(toItem))
}

const BOTTOM_BAR_LABELS: Record<string, string> = {
  'Minhas refeições': 'Refeições',
}

const BOTTOM_BAR_FOURTH_PRIORITY: Record<string, string[]> = {
  superadmin:          ['escolas'],
  admin_base:          ['escolas'],
  lider_base:          ['escolas'],
  dh:                  ['presenca'],
  hospitalidade:       ['hospedagem'],
  cozinha:             ['cozinha'],
  manutencao:          ['solicitacoes'],
  lider_eted:          ['inscricoes', 'escolas'],
  obreiro_eted:        ['inscricoes', 'escolas'],
  lider_ministerio:    ['ministerios'],
  obreiro_ministerio:  ['ministerios'],
}

function pickBottomBarItems(navItems: NavItem[], role: string): BottomBarItem[] {
  const regular = navItems.filter((i): i is RegularNavItem => !('divider' in i))
  const has = (icon: string) => regular.some(i => i.icon === icon)

  const fourthCandidates = BOTTOM_BAR_FOURTH_PRIORITY[role] ?? []
  const fourthTab = fourthCandidates.find(icon => has(icon)) ?? 'refeicoes'

  const priorities = ['dashboard', 'calendario', 'pendentes', fourthTab]

  const barItems: BottomBarItem[] = priorities
    .map(icon => regular.find(i => i.icon === icon))
    .filter((i): i is RegularNavItem => i != null)
    .map(i => ({
      href: i.href,
      label: BOTTOM_BAR_LABELS[i.label] ?? i.label,
      icon: i.icon,
      alert: i.alert,
    }))

  const barIcons = new Set(barItems.map(i => i.icon))
  const hasOverflowAlert = regular.some(i => !barIcons.has(i.icon) && i.alert)

  barItems.push({ href: '#more', label: 'Mais', icon: 'more', isMore: true, alert: hasOverflowAlert })

  return barItems
}

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> }

export default async function SlugLayout({ children, params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, active, logo_url, accent_color, department_assignments, role_accumulations, laundry_enabled, id_card_enabled')
    .eq('slug', slug)
    .single()

  if (!org || !org.active) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name), extra_roles, organizations(slug, name)')
    .eq('user_id', user.id)
    .eq('active', true)

  const userOrgRows = (orgUsers ?? []) as unknown as Array<{
    organization_id: string | null
    roles: { name: string } | null
    extra_roles?: string[] | null
    organizations: { slug: string; name: string } | null
  }>

  const sbAdmin = createAdminClient()
  const looseAdmin = asLooseClient(sbAdmin)
  const superadminRow = userOrgRows.find(row => row.roles?.name === 'superadmin')
  const supervisorRow = userOrgRows.find(row => row.roles?.name === 'supervisor_bases')
  const currentOrgRow = userOrgRows.find(row => row.organization_id === org.id)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? supervisorRow?.roles?.name ?? ''
  const { data: supervisedIdsData } = supervisorRow
    ? await looseAdmin.rpc('supervised_base_ids', { target_user_id: user.id })
    : { data: [] }
  const supervisedIds = new Set(((supervisedIdsData ?? []) as Array<{ organization_id: string }>).map(row => row.organization_id))
  const canSuperviseCurrentOrg = supervisedIds.has(org.id)
  const preview = await getRolePreview(realRole)
  const role = realRole === 'supervisor_bases' && canSuperviseCurrentOrg
    ? 'lider_base'
    : preview?.role ?? realRole
  const deptAssignments = (org.department_assignments as Record<string, string> | null)
    ?? { hospitalidade: 'hospitalidade', secretaria: 'secretaria' }
  const myDepartments = Object.entries(deptAssignments)
    .filter(([, assignedRole]) => assignedRole === role)
    .map(([department]) => department)

  const roleAccumulations = (org.role_accumulations as Record<string, string[]> | null) ?? {}
  const accumulatedRoles: string[] = roleAccumulations[role] ?? []
  const extraRoles: string[] = (currentOrgRow?.extra_roles as string[] | null) ?? []

  const { data: staffProfileForLinked } = await sbAdmin
    .from('staff_profiles')
    .select('person_id')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const personIdForLinked = staffProfileForLinked?.person_id

  const [{ data: leaderLinkedData }, { data: memberLinkedData }] = await Promise.all([
    sbAdmin
      .from('ministry_leaders')
      .select('ministry_id, ministries(linked_role)')
      .eq('user_id', user.id)
      .eq('organization_id', org.id),
    personIdForLinked
      ? sbAdmin
        .from('ministry_members')
        .select('ministry_id, ministries(linked_role)')
        .eq('person_id', personIdForLinked)
        .eq('active', true)
      : Promise.resolve({ data: [] as Array<{ ministry_id: string; ministries: { linked_role: string | null } | null }> }),
  ])

  const linkedRoles = [
    ...(leaderLinkedData ?? []),
    ...(memberLinkedData ?? []),
  ]
    .map(r => (r.ministries as { linked_role: string | null } | null)?.linked_role)
    .filter((r): r is string => !!r)

  const allRoles = [role, ...accumulatedRoles, ...extraRoles, ...linkedRoles]

  if (realRole !== 'superadmin' && !currentOrgRow && !canSuperviseCurrentOrg) redirect('/login')

  // ── Contagem de pendências para o alerta no nav ─────────────
  const isManagementUser = isManagementRole(role)
  const isLiderMinisterio  = role === 'lider_ministerio'
  const isObreiroMinisterio = role === 'obreiro_ministerio'
  const isObreiroEted = role === 'obreiro_eted'
  const isAluno = role === 'aluno'
  const isAssociado = role === 'associado'
  const isHospitalidade    = allRoles.includes('hospitalidade')
  const isLiderEted        = role === 'lider_eted'
  const isSecretaria       = allRoles.includes('secretaria')
  const isManutencaoUser   = allRoles.includes('manutencao')
  const canBuyMeals        = true

  let pendingTotal = 0

  if (canBuyMeals) {
    const { data } = await sbAdmin.from('kitchen_meal_consumers')
      .select('purchase_group_id, payment_proof_requested_at, payment_proof_uploaded_at')
      .eq('organization_id', org.id)
      .eq('requested_by', user.id)
      .eq('payment_status', 'pending')
      .not('payment_proof_requested_at', 'is', null)
    const purchasesNeedingProof = new Set((data ?? []).filter(row => {
      const requestedAt = row.payment_proof_requested_at
      const uploadedAt = row.payment_proof_uploaded_at
      return requestedAt && (!uploadedAt || new Date(requestedAt) > new Date(uploadedAt))
    }).map(row => row.purchase_group_id))
    pendingTotal += purchasesNeedingProof.size
  }

  if (isManagementUser || isLiderEted) {
    const [{ count: ic }, { count: sc }] = await Promise.all([
      sbAdmin.from('school_interest_forms')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .not('status', 'in', '("convertido","descartado")'),
      supabase.from('student_applications')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .in('status', ['pendente', 'em_analise']),
    ])
    pendingTotal += (ic ?? 0) + (sc ?? 0)
  }

  if (isManagementUser) {
    const [{ count: ac }, { count: mc }, { count: src }, { count: tc }] = await Promise.all([
      supabase.from('staff_applications')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .in('status', ['pendente', 'em_analise']),
      supabase.from('ministry_pending_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('status', 'pendente'),
      supabase.from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .in('status', ['pendente', 'em_analise']),
      sbAdmin.from('ministry_transfers')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('status', 'aceito_destino'),
    ])
    pendingTotal += (ac ?? 0) + (mc ?? 0) + (src ?? 0) + (tc ?? 0)
  }

  if (!isManagementUser && isManutencaoUser) {
    const { count } = await supabase.from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('target_department', 'manutencao')
      .in('status', ['pendente', 'em_analise'])
    pendingTotal += (count ?? 0)
  }

  if (isManagementUser || isSecretaria) {
    const { data } = await sbAdmin.from('kitchen_meal_consumers')
      .select('purchase_group_id')
      .eq('organization_id', org.id)
      .eq('payment_status', 'pending')
    pendingTotal += new Set((data ?? []).map(row => row.purchase_group_id)).size
  }

  if (isHospitalidade) {
    const { count } = await supabase.from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .in('target_department', myDepartments.length > 0 ? myDepartments : ['hospitalidade'])
      .in('status', ['pendente', 'em_analise'])
    pendingTotal += (count ?? 0)
  }

  if (!isManagementUser && !isHospitalidade && myDepartments.length > 0) {
    const { count } = await supabase.from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .in('target_department', myDepartments)
      .in('status', ['pendente', 'em_analise'])
    pendingTotal += (count ?? 0)
  }

  // ── Reservas pendentes (badge separado no nav) ───────────────────────────────
  let reservationsPending = 0

  if (isManagementUser) {
    const { count } = await sbAdmin.from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'pendente')
    reservationsPending = count ?? 0
  } else if (isHospitalidade) {
    const { count } = await supabase.from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('type', 'quarto')
      .eq('status', 'pendente')
    reservationsPending = count ?? 0
  } else if (isObreiroEted || isAluno || isAssociado) {
    const { count } = await supabase.from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('requested_by', user.id)
      .eq('status', 'pendente')
    reservationsPending = count ?? 0
  }

  if (isLiderMinisterio) {
    const ministryId = preview?.role === 'lider_ministerio' ? preview.ministryId : null
    const { data: lm } = ministryId
      ? { data: { ministry_id: ministryId } }
      : await supabase.from('ministry_leaders').select('ministry_id').eq('user_id', user.id).single()
    if (lm?.ministry_id) {
      const [{ count: reqCount }, { count: transferCount }] = await Promise.all([
        supabase.from('ministry_pending_requests')
          .select('*', { count: 'exact', head: true })
          .eq('ministry_id', lm.ministry_id).eq('status', 'pendente'),
        sbAdmin.from('ministry_transfers')
          .select('*', { count: 'exact', head: true })
          .eq('to_ministry_id', lm.ministry_id).eq('status', 'pendente_destino'),
      ])
      pendingTotal += (reqCount ?? 0) + (transferCount ?? 0)
    }
  }

  if (isObreiroMinisterio) {
    const ministryId = preview?.role === 'obreiro_ministerio' ? preview.ministryId : null
    if (ministryId) {
      const { count } = await supabase.from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('requester_id', user.id)
        .not('status', 'in', '("resolvido","rejeitado")')
      pendingTotal += (count ?? 0)
    }
  }

  const hasPending = pendingTotal > 0
  const isSuperAdmin = realRole === 'superadmin'
  let hasOwnCashScope = false

  if (role === 'lider_eted') {
    const schoolId = preview?.role === 'lider_eted'
      ? preview.schoolId
      : (await sbAdmin.from('school_leaders').select('school_id').eq('organization_id', org.id).eq('user_id', user.id).limit(1).maybeSingle()).data?.school_id

    if (schoolId) {
      const { count } = await looseAdmin
        .from('finance_cash_scopes')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('entity_type', 'school')
        .eq('school_id', schoolId)
        .eq('enabled', true)
      hasOwnCashScope = (count ?? 0) > 0
    }
  }

  if (role === 'lider_ministerio') {
    const ministryId = preview?.role === 'lider_ministerio'
      ? preview.ministryId
      : (await sbAdmin.from('ministry_leaders').select('ministry_id').eq('organization_id', org.id).eq('user_id', user.id).limit(1).maybeSingle()).data?.ministry_id

    if (ministryId) {
      const { count } = await looseAdmin
        .from('finance_cash_scopes')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('entity_type', 'ministry')
        .eq('ministry_id', ministryId)
        .eq('enabled', true)
      hasOwnCashScope = (count ?? 0) > 0
    }
  }

  const accentKey = (org as { accent_color?: string }).accent_color ?? 'laranja'
  const [{ data: previewSchools }, { data: previewMinistries }] = isSuperAdmin
    ? await Promise.all([
      sbAdmin.from('schools').select('id, name').eq('organization_id', org.id).eq('active', true).order('name'),
      sbAdmin.from('ministries').select('id, name').eq('organization_id', org.id).eq('active', true).order('name'),
    ])
    : [{ data: [] }, { data: [] }]

  const laundryEnabled = (org as { laundry_enabled?: boolean }).laundry_enabled ?? false

  // ── Mensagens novas no chat do ministério (desde a última visita) ──────────
  const muralSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let hasMinistryMessages = false
  let hasSchoolMessages = false

  const myMinistryIds = [...new Set([
    ...(leaderLinkedData ?? []).map(r => r.ministry_id),
    ...(memberLinkedData ?? []).map(r => r.ministry_id),
  ])]

  if (myMinistryIds.length > 0 && (isLiderMinisterio || allRoles.includes('obreiro_ministerio') || linkedRoles.length > 0)) {
    const [{ data: reads }, { data: msgs }] = await Promise.all([
      sbAdmin.from('ministry_message_reads')
        .select('ministry_id, last_read_at')
        .eq('user_id', user.id)
        .in('ministry_id', myMinistryIds),
      sbAdmin.from('ministry_messages')
        .select('ministry_id, created_at')
        .in('ministry_id', myMinistryIds)
        .neq('author_id', user.id),
    ])
    const lastReadMap = new Map((reads ?? []).map(r => [r.ministry_id, r.last_read_at]))
    hasMinistryMessages = (msgs ?? []).some(m => {
      const lastRead = lastReadMap.get(m.ministry_id)
      return !lastRead || new Date(m.created_at) > new Date(lastRead)
    })
  }

  if (allRoles.includes('lider_eted') || allRoles.includes('obreiro_eted')) {
    const { count } = await sbAdmin.from('school_messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .neq('author_id', user.id)
      .gte('created_at', muralSince)
    hasSchoolMessages = (count ?? 0) > 0
  }
  const idCardEnabled = (org as { id_card_enabled?: boolean }).id_card_enabled ?? false
  const navItems = buildNav(slug, role, [...accumulatedRoles, ...extraRoles, ...linkedRoles], hasPending, reservationsPending > 0, hasOwnCashScope, laundryEnabled, hasMinistryMessages, hasSchoolMessages, idCardEnabled)
  const bottomItems = pickBottomBarItems(navItems, role)

  // ── Menu de conta: modo Pessoal x Administração + troca de base ──────────
  const { universal, admin: adminNavItems, personal: personalNavItems } = splitNavByMode(navItems)
  const canSwitchMode = adminNavItems.length > 0
  const navMode = canSwitchMode ? await getNavMode() : 'pessoal'
  const sidebarItems: NavItem[] = navMode === 'administracao'
    ? [...universal, ...sectionize(adminNavItems)]
    : [...universal, ...personalNavItems]
  // "Ver tudo" mostra só o complemento do que já está na sidebar do modo atual
  // (ex.: itens do outro modo Pessoal/Administração) — não repete o que já é visível.
  const sidebarIcons = new Set(sidebarItems.filter((i): i is RegularNavItem => !('divider' in i)).map(i => i.icon))
  const allNavItems = dropEmptySections(
    buildAllAppsItems(universal, adminNavItems, personalNavItems)
      .filter(i => 'divider' in i || !sidebarIcons.has(i.icon)),
  )

  const myOrgs = userOrgRows
    .map(r => r.organizations)
    .filter((o): o is { slug: string; name: string } => !!o)

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const displayName = [metadata.full_name, metadata.name, metadata.fullName, metadata.display_name]
    .find((v): v is string => typeof v === 'string' && v.trim().length > 0) ?? null
  const avatarUrl = typeof metadata.avatar_url === 'string' && metadata.avatar_url.trim().length > 0
    ? metadata.avatar_url
    : null

  return (
    <div className="flex flex-col h-dvh">
      <style>{`:root{${accentCssVars(accentKey)}}`}</style>
      <div className="shrink-0 h-[env(safe-area-inset-top)] bg-dark-950" />
      {isSuperAdmin && (
        <SuperAdminContextBar
          mode="admin"
          slug={slug}
          baseName={org.name}
          preview={preview}
          schools={(previewSchools ?? []) as Array<{ id: string; name: string }>}
          ministries={(previewMinistries ?? []) as Array<{ id: string; name: string }>}
        />
      )}
      <AppShell
        items={sidebarItems}
        bottomBarItems={bottomItems}
        subtitle={org.name}
        logoUrl={(org as { logo_url?: string | null }).logo_url ?? undefined}
        className="flex flex-1 min-h-0 overflow-hidden"
        allNavItems={allNavItems}
        account={{
          name: displayName,
          email: user.email ?? '',
          avatarUrl,
          orgSlug: slug,
          orgName: org.name,
          orgs: myOrgs,
          canSwitchMode,
          mode: navMode,
        }}
      >
        {children}
      </AppShell>
      <FeedbackButton />
      <Toaster position="top-right" richColors closeButton />
      <Suspense>
        <FlashToast />
      </Suspense>
      <PushNotificationManager />
    </div>
  )
}
