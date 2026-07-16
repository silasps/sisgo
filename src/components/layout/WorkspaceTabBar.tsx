'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle, Users, LayoutDashboard, Settings } from 'lucide-react'

const ICON_MAP = {
  chat: MessageCircle,
  equipe: Users,
  geral: LayoutDashboard,
  configuracoes: Settings,
}

type Tab = { href: string; label: string; icon?: keyof typeof ICON_MAP; alsoMatches?: string[] }

export function WorkspaceTabBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname()

  function isActive(tab: Tab) {
    if (tab.href === tabs[0]?.href) {
      return pathname === tab.href || pathname === tab.href + '/'
    }
    if (pathname.startsWith(tab.href)) return true
    return tab.alsoMatches?.some(p => pathname.startsWith(p)) ?? false
  }

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-4 md:px-6 scrollbar-none">
      {tabs.map(tab => {
        const active = isActive(tab)
        const Icon = tab.icon ? ICON_MAP[tab.icon] : undefined
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {Icon && <Icon size={15} aria-hidden />}
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
