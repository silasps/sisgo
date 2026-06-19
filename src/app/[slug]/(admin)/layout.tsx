import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppShell } from '@/components/layout/AppShell'
import { SuperAdminContextBar } from '@/components/layout/SuperAdminContextBar'
import { notFound, redirect } from 'next/navigation'
import { accentCssVars } from '@/lib/accent-colors'
import { getRolePreview } from '@/lib/role-preview'
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
const PESSOAL_ICONS   = new Set(['refeicoes', 'contas'])

function addPersonalSplit(items: RegularNavItem[], personalIcons = PESSOAL_ICONS): NavItem[] {
  const op   = items.filter(i => !personalIcons.has(i.icon))
  const pers = items.filter(i =>  personalIcons.has(i.icon))
  if (pers.length === 0) return op
  return [...op, PESSOAL_DIVIDER, ...pers]
}

function buildNav(slug: string, role: string, accumulatedRoles: string[], hasPending: boolean, hasReservationsPending: boolean, hasOwnCashScope: boolean): NavItem[] {
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
    { href: `/${slug}/dashboard`,    label: 'Dashboard',        icon: 'dashboard',     show: true },
    { href: `/${slug}/calendario`,   label: 'Calendário',       icon: 'calendario',    show: true },
    { href: `/${slug}/pendentes`,    label: 'Pendentes',        icon: 'pendentes',     show: true, alert: hasPending },
    { href: `/${slug}/pessoas`,      label: 'Pessoas',          icon: 'pessoas',       show: true },
    { href: `/${slug}/presenca`,     label: 'Presença',         icon: 'presenca',      show: isManagement || is('secretaria') || is('hospitalidade') || isCozinha || is('lider_eted') || isObreiroEted || isLiderMinisterio || isObreiroMinisterio },
    { href: `/${slug}/obreiros`,     label: 'Obreiros',         icon: 'obreiros',      show: isManagement },
    { href: `/${slug}/escolas`,      label: 'Escolas',          icon: 'escolas',       show: isManagement || is('lider_eted') || isObreiroEted },
    { href: `/${slug}/inscricoes`,   label: 'Inscrições',       icon: 'inscricoes',    show: isManagement || is('lider_eted') },
    { href: `/${slug}/ministerios`,  label: 'Ministérios',      icon: 'ministerios',   show: isManagement || isLiderMinisterio || isObreiroMinisterio },
    { href: `/${slug}/reservas`,     label: 'Reservas',         icon: 'reservas',      show: canSeeReservas, alert: hasReservationsPending },
    { href: `/${slug}/hospedagem`,   label: 'Hospedagem',       icon: 'hospedagem',    show: canSeeHospedagem },
    { href: `/${slug}/hospedagem/quartos`, label: 'Quartos',    icon: 'quartos',       show: canSeeHospedagem },
    { href: `/${slug}/refeicoes`,    label: 'Minhas refeições', icon: 'refeicoes',     show: canBuyMeals },
    { href: `/${slug}/caixa`,        label: 'Caixa da área',    icon: 'caixa',         show: hasOwnCashScope },
    { href: `/${slug}/cozinha`,      label: 'Cozinha',          icon: 'cozinha',       show: isManagement || is('secretaria') || isCozinha },
    { href: `/${slug}/cozinha/estoque`, label: 'Estoque',       icon: 'estoque',       show: isManagement || is('secretaria') || isCozinha },
    { href: `/${slug}/cozinha/receitas`, label: 'Receitas',     icon: 'receitas',      show: isManagement || is('secretaria') || isCozinha },
    { href: `/${slug}/manutencao`,   label: 'Solicitações',     icon: 'solicitacoes',  show: true },
    { href: `/${slug}/manutencao/estoque`, label: 'Est. Manutenção', icon: 'estoque',  show: canSeeManutencao },
    { href: `/${slug}/financeiro`,   label: 'Financeiro',       icon: 'financeiro',    show: canSeeGeneralFinance },
    { href: `/${slug}/minhas-contas`, label: 'Minhas Contas',   icon: 'contas',        show: true },
    { href: `/${slug}/configuracoes`, label: 'Configurações',   icon: 'configuracoes', show: isManagement },
  ]

  if (isHospitalidade) {
    return addPersonalSplit(all.filter(pick('/dashboard', '/calendario', '/pendentes', '/presenca', '/pessoas', '/reservas', '/hospedagem', '/hospedagem/quartos', '/manutencao', '/refeicoes', '/minhas-contas')).map(toItem))
  }

  if (isCozinha) {
    return addPersonalSplit(all.filter(pick('/dashboard', '/calendario', '/pendentes', '/cozinha', '/cozinha/estoque', '/cozinha/receitas', '/manutencao', '/refeicoes', '/minhas-contas')).map(toItem))
  }

  if (isManutencao) {
    return addPersonalSplit(all.filter(pick('/dashboard', '/calendario', '/pendentes', '/manutencao', '/manutencao/estoque', '/refeicoes', '/minhas-contas')).map(toItem))
  }

  if (isObreiroMinisterio) {
    return addPersonalSplit(all.filter(pick('/dashboard', '/calendario', '/pendentes', '/presenca', '/ministerios', '/reservas', '/manutencao', '/refeicoes', '/minhas-contas')).map(toItem))
  }

  if (isObreiroEted) {
    return addPersonalSplit(all.filter(pick('/dashboard', '/calendario', '/pendentes', '/presenca', '/escolas', '/reservas', '/manutencao', '/refeicoes', '/minhas-contas')).map(toItem))
  }

  if (isAluno || isAssociado) {
    return addPersonalSplit(
      all.filter(pick('/dashboard', '/calendario', '/pendentes', '/reservas', '/manutencao', '/refeicoes', '/minhas-contas')).map(toItem),
      new Set(['reservas', 'refeicoes', 'contas']),
    )
  }

  return addPersonalSplit(all.filter(i => i.show).map(toItem))
}

const BOTTOM_BAR_LABELS: Record<string, string> = {
  'Dashboard': 'Início',
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

function pickOverflowItems(navItems: NavItem[], bottomBarItems: BottomBarItem[]): NavItem[] {
  const barIcons = new Set(bottomBarItems.filter(i => !i.isMore).map(i => i.icon))

  const filtered: NavItem[] = []
  for (const item of navItems) {
    if ('divider' in item) {
      filtered.push(item)
    } else if (!barIcons.has(item.icon)) {
      filtered.push(item)
    }
  }

  return filtered.filter((item, i, arr) => {
    if (!('divider' in item)) return true
    if (i === 0 || i === arr.length - 1) return false
    return arr.slice(i + 1).some(x => !('divider' in x))
  })
}

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> }

export default async function SlugLayout({ children, params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, active, logo_url, accent_color, department_assignments, role_accumulations')
    .eq('slug', slug)
    .single()

  if (!org || !org.active) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name), extra_roles')
    .eq('user_id', user.id)
    .eq('active', true)

  const userOrgRows = (orgUsers ?? []) as unknown as Array<{
    organization_id: string | null
    roles: { name: string } | null
    extra_roles?: string[] | null
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
  const allRoles = [role, ...accumulatedRoles, ...extraRoles]

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

  const navItems = buildNav(slug, role, [...accumulatedRoles, ...extraRoles], hasPending, reservationsPending > 0, hasOwnCashScope)
  const bottomItems = pickBottomBarItems(navItems, role)

  return (
    <div className="flex flex-col h-dvh">
      <style>{`:root{${accentCssVars(accentKey)}}`}</style>
      <div className={`shrink-0 h-[env(safe-area-inset-top)] ${isSuperAdmin ? 'bg-gray-900' : 'bg-white'}`} />
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
        items={navItems}
        bottomBarItems={bottomItems}
        overflowItems={pickOverflowItems(navItems, bottomItems)}
        subtitle={org.name}
        logoUrl={(org as { logo_url?: string | null }).logo_url ?? undefined}
        className="flex flex-1 min-h-0 overflow-hidden"
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
