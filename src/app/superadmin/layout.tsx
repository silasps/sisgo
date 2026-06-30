import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { accentCssVars } from '@/lib/accent-colors'

const NAV: { href: string; label: string; icon: string }[] = [
  { href: '/superadmin', label: 'Visão Geral', icon: 'dashboard' },
  { href: '/superadmin/bases', label: 'Bases', icon: 'bases' },
  { href: '/superadmin/usuarios', label: 'Usuários', icon: 'pessoas' },
  { href: '/superadmin/supervisao', label: 'Supervisão', icon: 'supervisao' },
  { href: '/superadmin/inscricoes', label: 'Inscrições', icon: 'inscricoes' },
  { href: '/superadmin/configuracoes', label: 'Configurações', icon: 'configuracoes' },
  { href: '/superadmin/dev', label: 'Área Dev', icon: 'dev' },
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

  const currentUser = {
    email: user.email ?? '',
    name: (user.user_metadata?.full_name as string | undefined) ?? undefined,
    badge: 'Super Admin',
  }

  return (
    <div className="flex flex-col h-dvh">
      <style>{`:root{${accentCssVars(accentKey)}}`}</style>
      <div className="shrink-0 h-[env(safe-area-inset-top)] bg-white" />
      <AppShell items={NAV} subtitle="Super Admin" logoUrl={logoUrl} sisgoLogo user={currentUser} className="flex flex-1 min-h-0 overflow-hidden">
        {children}
      </AppShell>
    </div>
  )
}
