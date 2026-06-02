import { Sidebar } from '@/components/layout/Sidebar'

const NAV: { href: string; label: string; icon: string }[] = [
  { href: '/superadmin', label: 'Visão Geral', icon: '◈' },
  { href: '/superadmin/bases', label: 'Bases', icon: '🏛' },
]

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar items={NAV} subtitle="Super Admin" />
      <div className="flex-1 ml-60 flex flex-col overflow-auto">
        {children}
      </div>
    </div>
  )
}
