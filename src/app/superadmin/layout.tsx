import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const NAV: { href: string; label: string; icon: string }[] = [
  { href: '/superadmin', label: 'Visão Geral', icon: '◈' },
  { href: '/superadmin/bases', label: 'Bases', icon: '🏛' },
  { href: '/superadmin/supervisao', label: 'Supervisão', icon: '◎' },
  { href: '/superadmin/inscricoes', label: 'Inscrições', icon: '📋' },
  { href: '/superadmin/dev', label: 'Área Dev', icon: '🛠' },
]

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)

  const isSuperAdmin = (data ?? []).some(row => (row.roles as unknown as { name: string } | null)?.name === 'superadmin')
  if (!isSuperAdmin) redirect('/login')

  return (
    <AppShell items={NAV} subtitle="Super Admin">
      {children}
    </AppShell>
  )
}
