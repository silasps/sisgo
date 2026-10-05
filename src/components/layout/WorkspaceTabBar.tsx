'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle, Users, LayoutDashboard, Settings, Smile, Kanban, GraduationCap } from 'lucide-react'

const ICON_MAP = {
  chat: MessageCircle,
  equipe: Users,
  geral: LayoutDashboard,
  configuracoes: Settings,
  pesquisa: Smile,
  tarefas: Kanban,
  alunos: GraduationCap,
}

type Tab = { href: string; label: string; icon?: keyof typeof ICON_MAP; alsoMatches?: string[] }

export function WorkspaceTabBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname()

  // Só um ganha o destaque: pega o href (próprio ou de alsoMatches) mais
  // específico (mais longo) que bate com o caminho atual — em vez de cada
  // aba decidir sozinha se está ativa, o que deixava margem pra mais de uma
  // "achar" que bate (ex.: Geral, cujo href é prefixo de todos os outros).
  let activeIndex = -1
  let bestLen = -1
  tabs.forEach((tab, i) => {
    const candidates = i === 0 ? [tab.href] : [tab.href, ...(tab.alsoMatches ?? [])]
    for (const href of candidates) {
      const matches = i === 0 ? (pathname === href || pathname === href + '/') : pathname.startsWith(href)
      if (matches && href.length > bestLen) {
        bestLen = href.length
        activeIndex = i
      }
    }
  })

  return (
    <nav className="flex w-full min-w-0 gap-1 overflow-x-auto border-b border-gray-200 bg-white px-4 md:px-6 scrollbar-none">
      {tabs.map((tab, i) => {
        const active = i === activeIndex
        const Icon = tab.icon ? ICON_MAP[tab.icon] : undefined
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch={false}
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
