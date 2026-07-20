'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutGrid, Search, X } from 'lucide-react'
import { useAllApps, type NavItem } from './all-apps-context'
import { ICON_MAP } from './Sidebar'

/** Botão de gatilho — usado no Header. O painel em si mora em AllAppsPanel,
 * montado uma vez pelo AppShell, pra funcionar mesmo em páginas sem Header
 * (ex.: formulários públicos sem layout próprio). */
export function AllAppsMenu() {
  const { items, openAllApps } = useAllApps()

  if (items.length === 0) return null

  return (
    <button
      onClick={openAllApps}
      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors shrink-0"
      aria-label="Ver tudo"
    >
      <LayoutGrid size={18} />
    </button>
  )
}

/** O painel de fato (busca + grid). Sempre montado pelo AppShell — reage ao
 * estado compartilhado independente de quem disparou a abertura (o ícone do
 * Header ou o botão "Mais" do BottomNav). */
export function AllAppsPanel() {
  const { items, open, closeAllApps } = useAllApps()
  const [query, setQuery] = useState('')
  const pathname = usePathname()

  useEffect(() => { if (open) closeAllApps() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) setQuery('') }, [open])

  if (!open || items.length === 0) return null

  const flatItems = items.filter((i): i is Exclude<NavItem, { divider: true }> => !('divider' in i))
  const q = query.trim().toLowerCase()
  const filtered = q ? flatItems.filter(i => i.label.toLowerCase().includes(q)) : null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-white flex flex-col md:bg-black/30 md:items-start md:justify-center md:pt-20"
      onClick={e => { if (e.target === e.currentTarget) closeAllApps() }}
    >
      <div className="flex flex-col w-full h-full md:h-auto md:max-h-[80vh] md:max-w-2xl md:mx-auto md:rounded-2xl md:shadow-xl bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar em tudo que o sisgo oferece..."
            className="flex-1 min-w-0 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
          />
          <button
            onClick={closeAllApps}
            className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {filtered ? (
            filtered.length > 0 ? (
              <AppGrid items={filtered} />
            ) : (
              <p className="text-sm text-gray-400 text-center py-10">Nada encontrado para &ldquo;{query}&rdquo;.</p>
            )
          ) : (
            <SectionedGrid items={items} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SectionedGrid({ items }: { items: NavItem[] }) {
  const groups = useMemo(() => {
    const out: Array<{ label: string; items: Exclude<NavItem, { divider: true }>[] }> = []
    let current: { label: string; items: Exclude<NavItem, { divider: true }>[] } | null = null
    for (const item of items) {
      if ('divider' in item) {
        current = { label: item.label, items: [] }
        out.push(current)
      } else {
        if (!current) { current = { label: '', items: [] }; out.push(current) }
        current.items.push(item)
      }
    }
    return out
  }, [items])

  return (
    <div className="space-y-6">
      {groups.map((group, idx) => (
        <div key={`${group.label}-${idx}`}>
          {group.label && (
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">{group.label}</h3>
          )}
          <AppGrid items={group.items} />
        </div>
      ))}
    </div>
  )
}

function AppGrid({ items }: { items: Exclude<NavItem, { divider: true }>[] }) {
  const { closeAllApps } = useAllApps()

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {items.map(item => {
        const Icon = ICON_MAP[item.icon]
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeAllApps}
            className="relative flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white p-3 text-center hover:border-brand-200 hover:bg-brand-50/40 transition-colors"
          >
            {item.alert && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
            {Icon && (
              <span className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-600">
                <Icon size={17} aria-hidden />
              </span>
            )}
            <span className="text-xs font-medium text-gray-700 leading-tight line-clamp-2">{item.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
