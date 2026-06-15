import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { accentCssVars } from '@/lib/accent-colors'

const NAV: { href: string; label: string; icon: string }[] = [
  { href: '/superadmin', label: 'Visão Geral', icon: '◈' },
  { href: '/superadmin/bases', label: 'Bases', icon: '🏛' },
  { href: '/superadmin/supervisao', label: 'Supervisão', icon: '◎' },
  { href: '/superadmin/inscricoes', label: 'Inscrições', icon: '📋' },
  { href: '/superadmin/configuracoes', label: 'Configurações', icon: '⚙️' },
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

  const db = createAdminClient()
  const { data: settings } = await db
    .from('system_settings')
    .select('key, value')
    .in('key', ['superadmin_logo_url', 'superadmin_accent_color'])

  const map = Object.fromEntries((settings ?? []).map(r => [r.key, r.value]))
  const accentKey = map['superadmin_accent_color'] ?? 'laranja'
  const logoUrl = map['superadmin_logo_url'] ?? undefined

  return (
    <>
      <style>{`:root{${accentCssVars(accentKey)}}`}</style>
      <AppShell items={NAV} subtitle="Super Admin" logoUrl={logoUrl}>
        {children}
      </AppShell>
    </>
  )
}
