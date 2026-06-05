import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'
import { SuperAdminContextBar } from '@/components/layout/SuperAdminContextBar'
import { notFound, redirect } from 'next/navigation'

type NavItem = { href: string; label: string; icon: string }

const MANAGEMENT_ROLES = ['superadmin', 'admin_base', 'lider_base', 'dh']

function buildNav(slug: string, role: string): NavItem[] {
  const is = (r: string) => role === r
  const isManagement = MANAGEMENT_ROLES.includes(role)

  const all: Array<NavItem & { show: boolean }> = [
    { href: `/${slug}`,              label: 'Dashboard',    icon: '◈',  show: true },
    { href: `/${slug}/pendentes`,    label: 'Pendentes',    icon: '⚠',  show: true },
    { href: `/${slug}/pessoas`,      label: 'Pessoas',      icon: '👥', show: true },
    { href: `/${slug}/escolas`,      label: 'Escolas',      icon: '📚', show: isManagement || is('lider_eted') },
    { href: `/${slug}/inscricoes`,   label: 'Inscrições',   icon: '📋', show: isManagement || is('lider_eted') },
    { href: `/${slug}/ministerios`,  label: 'Ministérios',  icon: '🎵', show: isManagement },
    { href: `/${slug}/financeiro`,   label: 'Financeiro',   icon: '💰', show: isManagement || is('secretaria') },
    { href: `/${slug}/configuracoes`,label: 'Configurações',icon: '⚙',  show: isManagement },
  ]

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
    .select('id, name, active')
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

  const isSuperAdmin = role === 'superadmin'

  return (
    <div className="flex flex-col h-dvh">
      {isSuperAdmin && (
        <SuperAdminContextBar mode="admin" slug={slug} baseName={org.name} />
      )}
      <AppShell
        items={buildNav(slug, role)}
        subtitle={org.name}
        className="flex flex-1 min-h-0 overflow-hidden"
      >
        {children}
      </AppShell>
    </div>
  )
}
