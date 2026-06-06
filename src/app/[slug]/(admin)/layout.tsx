import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppShell } from '@/components/layout/AppShell'
import { SuperAdminContextBar } from '@/components/layout/SuperAdminContextBar'
import { notFound, redirect } from 'next/navigation'
import { accentCssVars } from '@/lib/accent-colors'

type NavItem = { href: string; label: string; icon: string; alert?: boolean }

const MANAGEMENT_ROLES = ['superadmin', 'admin_base', 'lider_base', 'dh']

function buildNav(slug: string, role: string, hasPending: boolean): NavItem[] {
  const is = (r: string) => role === r
  const isManagement       = MANAGEMENT_ROLES.includes(role)
  const isLiderMinisterio  = is('lider_ministerio')
  const isHospitalidade    = is('hospitalidade')

  const all: Array<NavItem & { show: boolean }> = [
    { href: `/${slug}/dashboard`,    label: 'Dashboard',    icon: '◈',  show: true },
    { href: `/${slug}/pendentes`,    label: 'Pendentes',    icon: '⚠',  show: true, alert: hasPending },
    { href: `/${slug}/pessoas`,      label: 'Pessoas',      icon: '👥', show: true },
    { href: `/${slug}/escolas`,      label: 'Escolas',      icon: '📚', show: isManagement || is('lider_eted') },
    { href: `/${slug}/inscricoes`,   label: 'Inscrições',   icon: '📋', show: isManagement || is('lider_eted') },
    { href: `/${slug}/ministerios`,  label: 'Ministérios',  icon: '🎵', show: isManagement || isLiderMinisterio },
    { href: `/${slug}/financeiro`,   label: 'Financeiro',   icon: '💰', show: isManagement || is('secretaria') },
    { href: `/${slug}/configuracoes`,label: 'Configurações',icon: '⚙',  show: isManagement },
  ]

  // Hospitalidade só precisa de Pendentes e Pessoas
  if (isHospitalidade) {
    return all.filter(i => i.href.endsWith('/pendentes') || i.href.endsWith('/pessoas')).map(({ show: _, ...i }) => i)
  }

  return all.filter(i => i.show).map(({ show: _, ...i }) => i)
}

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> }

export default async function SlugLayout({ children, params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, active, logo_url, accent_color')
    .eq('slug', slug)
    .single()

  if (!org || !org.active) notFound()

  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  const role = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''

  if (role !== 'superadmin') {
    const { data: access } = await supabase
      .from('organization_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', org.id)
      .eq('active', true)
      .single()

    if (!access) redirect('/login')
  }

  // ── Contagem de pendências para o alerta no nav ─────────────
  const sbAdmin = createAdminClient()

  const isManagementRole   = MANAGEMENT_ROLES.includes(role)
  const isLiderMinisterio  = role === 'lider_ministerio'
  const isHospitalidade    = role === 'hospitalidade'
  const isLiderEted        = role === 'lider_eted'

  let pendingTotal = 0

  if (isManagementRole || isLiderEted) {
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

  if (isManagementRole) {
    const [{ count: ac }, { count: mc }, { count: src }] = await Promise.all([
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
    ])
    pendingTotal += (ac ?? 0) + (mc ?? 0) + (src ?? 0)
  }

  if (isHospitalidade) {
    const { count } = await supabase.from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('target_department', 'hospitalidade')
      .in('status', ['pendente', 'em_analise'])
    pendingTotal += (count ?? 0)
  }

  if (isLiderMinisterio) {
    const { data: lm } = await supabase
      .from('ministry_leaders').select('ministry_id').eq('user_id', user.id).single()
    if (lm?.ministry_id) {
      const { count } = await supabase.from('ministry_pending_requests')
        .select('*', { count: 'exact', head: true })
        .eq('ministry_id', lm.ministry_id).eq('status', 'pendente')
      pendingTotal += (count ?? 0)
    }
  }

  const hasPending = pendingTotal > 0
  const isSuperAdmin = role === 'superadmin'

  const accentKey = (org as { accent_color?: string }).accent_color ?? 'laranja'

  return (
    <div className="flex flex-col h-dvh">
      <style>{`:root{${accentCssVars(accentKey)}}`}</style>
      {isSuperAdmin && (
        <SuperAdminContextBar mode="admin" slug={slug} baseName={org.name} />
      )}
      <AppShell
        items={buildNav(slug, role, hasPending)}
        subtitle={org.name}
        logoUrl={(org as { logo_url?: string | null }).logo_url ?? undefined}
        className="flex flex-1 min-h-0 overflow-hidden"
      >
        {children}
      </AppShell>
    </div>
  )
}
