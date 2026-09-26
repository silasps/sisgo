'use client'

import { useMemo, useState } from 'react'
import { User, CalendarDays, ArrowUpDown } from 'lucide-react'
import type { BoardColumn, BoardCard } from './types'
import { PRIORITY_STYLES, labelColor } from './types'

type SortKey = 'due_date' | 'priority' | 'column'
const PRIORITY_RANK: Record<BoardCard['priority'], number> = { alta: 0, media: 1, baixa: 2 }

export function ListView({ columns, cards, memberNameById, onCardClick }: {
  columns: BoardColumn[]
  cards: BoardCard[]
  memberNameById: Map<string, string>
  onCardClick: (card: BoardCard) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('due_date')
  const columnNameById = useMemo(() => new Map(columns.map(c => [c.id, c.name])), [columns])
  const columnIndexById = useMemo(() => new Map(columns.map((c, i) => [c.id, i])), [columns])

  const sorted = useMemo(() => {
    const list = [...cards]
    list.sort((a, b) => {
      if (sortKey === 'due_date') {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      }
      if (sortKey === 'priority') return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      return (columnIndexById.get(a.column_id) ?? 0) - (columnIndexById.get(b.column_id) ?? 0)
    })
    return list
  }, [cards, sortKey, columnIndexById])

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'due_date', label: 'Prazo' },
    { key: 'priority', label: 'Prioridade' },
    { key: 'column', label: 'Coluna' },
  ]

  if (cards.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-10">Nenhuma tarefa ainda.</p>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 text-xs text-gray-400">
        <ArrowUpDown size={12} /> Ordenar por:
        {SORT_OPTIONS.map(o => (
          <button
            key={o.key}
            type="button"
            onClick={() => setSortKey(o.key)}
            className={`px-2 py-0.5 rounded-full transition-colors ${sortKey === o.key ? 'bg-brand-50 text-brand-700 font-medium' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="divide-y divide-gray-100">
        {sorted.map(card => {
          const priority = PRIORITY_STYLES[card.priority]
          const assigneeName = card.assignee_person_id ? memberNameById.get(card.assignee_person_id) : null
          const overdue = card.due_date && new Date(`${card.due_date}T23:59:59`).getTime() < Date.now() && !card.completed_at
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onCardClick(card)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${priority.className}`}>{priority.label}</span>
              <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{card.title}</span>
              {card.labels && card.labels.length > 0 && (
                <span className="hidden md:flex items-center gap-1 shrink-0">
                  {card.labels.slice(0, 2).map(l => (
                    <span key={l} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${labelColor(l)}`}>{l}</span>
                  ))}
                </span>
              )}
              <span className="hidden sm:inline text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">{columnNameById.get(card.column_id) ?? '—'}</span>
              {assigneeName && (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-500 shrink-0">
                  <User size={11} /> {assigneeName.split(' ')[0]}
                </span>
              )}
              {card.due_date && (
                <span className={`inline-flex items-center gap-1 text-xs shrink-0 ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                  <CalendarDays size={11} /> {new Date(`${card.due_date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
