import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '◈' },
  { href: '/admin/pessoas', label: 'Pessoas', icon: '👥' },
  { href: '/admin/obreiros', label: 'Obreiros', icon: '⛪' },
  { href: '/admin/alunos', label: 'Alunos', icon: '🎓' },
  { href: '/admin/escolas', label: 'Escolas', icon: '📚' },
  { href: '/admin/ministerios', label: 'Ministérios', icon: '🎵' },
  { href: '/admin/financeiro', label: 'Financeiro', icon: '💰' },
  { href: '/admin/configuracoes', label: 'Configurações', icon: '⚙' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let orgName = 'Minha Base'
  if (user) {
    const { data } = await supabase
      .from('organization_users')
      .select('organizations(name)')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    const org = (data as unknown as { organizations: { name: string } | null } | null)?.organizations
    if (org?.name) orgName = org.name
  }

  return (
    <AppShell items={NAV} subtitle={orgName}>
      {children}
    </AppShell>
  )
}
