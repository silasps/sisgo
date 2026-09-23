'use client'

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { LayoutDashboard, Music, GraduationCap } from 'lucide-react'

export type AreaTab = {
  key: string
  label: string
  kind: 'principal' | 'ministerio' | 'escola'
  /** Itens aguardando ação nessa área — aparece como contador na aba. */
  badge?: number
}

const ICONS = { principal: LayoutDashboard, ministerio: Music, escola: GraduationCap }

/**
 * Alterna entre as áreas que o usuário acumula (função principal, cada
 * ministério, cada escola). Os painéis já chegam renderizados do servidor;
 * trocar de aba só troca qual deles aparece, sem nova requisição. A aba ativa
 * vai pra `?area=` pra sobreviver a reload e poder ser compartilhada.
 * Com uma área só, não mostra barra nenhuma — fica igual ao dashboard simples.
 */
export function AreaTabs({ tabs, panels, initialKey }: {
  tabs: AreaTab[]
  panels: ReactNode[]
  initialKey?: string
}) {
  const [active, setActive] = useState(() => Math.max(0, tabs.findIndex(t => t.key === initialKey)))
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  if (tabs.length <= 1) return panels[0] ? <div className="space-y-5">{panels[0]}</div> : null

  function select(index: number) {
    setActive(index)
    const url = new URL(window.location.href)
    url.searchParams.set('area', tabs[index].key)
    window.history.replaceState(null, '', url)
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (index + delta + tabs.length) % tabs.length
    select(next)
    tabRefs.current[next]?.focus()
  }

  const current = tabs[active]

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Minhas áreas"
        className="-mx-4 md:mx-0 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 md:px-0 scrollbar-none"
      >
        {tabs.map((tab, i) => {
          const Icon = ICONS[tab.kind]
          const selected = i === active
          return (
            <button
              key={tab.key}
              ref={el => { tabRefs.current[i] = el }}
              type="button"
              role="tab"
              id={`area-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`area-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(i)}
              onKeyDown={e => onKeyDown(e, i)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <Icon size={15} aria-hidden />
              <span className="max-w-[11rem] truncate">{tab.label}</span>
              {!!tab.badge && tab.badge > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-red-700">
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* key força remontar: números animados e o stagger rodam de novo ao trocar */}
      <div
        key={current.key}
        role="tabpanel"
        id={`area-panel-${current.key}`}
        aria-labelledby={`area-tab-${current.key}`}
        className="space-y-5"
      >
        {panels[active]}
      </div>
    </div>
  )
}
