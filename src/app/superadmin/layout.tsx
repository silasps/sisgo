import { AppShell } from '@/components/layout/AppShell'

const NAV: { href: string; label: string; icon: string }[] = [
  { href: '/superadmin', label: 'Visão Geral', icon: '◈' },
  { href: '/superadmin/bases', label: 'Bases', icon: '🏛' },
]

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell items={NAV} subtitle="Super Admin">
      {children}
    </AppShell>
  )
}
