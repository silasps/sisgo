import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '◈' },
  { href: '/admin/pessoas', label: 'Pessoas', icon: '👥' },
  { href: '/admin/obreiros', label: 'Obreiros', icon: '⛪' },
  { href: '/admin/alunos', label: 'Alunos', icon: '🎓' },
  { href: '/admin/escolas', label: 'Escolas', icon: '📚' },
  { href: '/admin/ministerios', label: 'Ministérios', icon: '🎵' },
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
    <div className="flex h-screen overflow-hidden">
      <Sidebar items={NAV} subtitle={orgName} />
      <div className="flex-1 ml-60 flex flex-col overflow-auto">
        {children}
      </div>
    </div>
  )
}
