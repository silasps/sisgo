'use client'

import { useState, type ReactNode } from 'react'

/** Duas abas simples (Escola / Turmas) — troca só visibilidade, sem desmontar,
 * pra formulários com estado (ex.: <details> aberto) não perderem contexto. */
export function SchoolConfigTabs({ escola, turmas, turmasCount, initialTab }: {
  escola: ReactNode
  turmas: ReactNode
  turmasCount: number
  /** Abre direto na aba Turmas — usado por links tipo "0 Turmas" na Geral (?tab=turmas). */
  initialTab?: 'escola' | 'turmas'
}) {
  const [tab, setTab] = useState<'escola' | 'turmas'>(initialTab ?? 'escola')

  return (
    <div>
      <div role="tablist" aria-label="Configurações" className="flex gap-1 border-b border-gray-200 mb-5">
        {(['escola', 'turmas'] as const).map(key => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {key === 'escola' ? 'Escola' : `Turmas${turmasCount > 0 ? ` (${turmasCount})` : ''}`}
          </button>
        ))}
      </div>
      <div className={tab === 'escola' ? 'space-y-6' : 'hidden'}>{escola}</div>
      <div className={tab === 'turmas' ? 'space-y-4' : 'hidden'}>{turmas}</div>
    </div>
  )
}
