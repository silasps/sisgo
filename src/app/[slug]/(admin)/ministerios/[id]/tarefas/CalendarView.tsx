'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import type { BoardCard } from './types'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const PRIORITY_DOT: Record<BoardCard['priority'], string> = {
  alta: 'bg-red-500',
  media: 'bg-blue-500',
  baixa: 'bg-gray-400',
}

export function CalendarView({ cards, memberNameById, onCardClick }: {
  cards: BoardCard[]
  memberNameById: Map<string, string>
  onCardClick: (card: BoardCard) => void
}) {
  const today = useMemo(() => new Date(), [])
  const [offset, setOffset] = useState(0)

  const viewDate = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = new Date(year, month, 1).getDay()
  const todayStr = today.toISOString().slice(0, 10)

  const cardsByDay = useMemo(() => {
    const map = new Map<string, BoardCard[]>()
    for (const c of cards) {
      if (!c.due_date) continue
      map.set(c.due_date, [...(map.get(c.due_date) ?? []), c])
    }
    return map
  }, [cards])

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const withoutDueDate = cards.filter(c => !c.due_date)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800 capitalize">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setOffset(o => o - 1)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" aria-label="Mês anterior">
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => setOffset(o => o + 1)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" aria-label="Próximo mês">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map(d => <span key={d} className="text-[10px] font-medium text-gray-400 py-1">{d}</span>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayCards = cardsByDay.get(dateStr) ?? []
          const isToday = dateStr === todayStr
          return (
            <div key={i} className={`min-h-16 rounded-lg p-1 text-left ${isToday ? 'bg-brand-50 ring-1 ring-brand-200' : 'bg-gray-50/50'}`}>
              <span className={`text-xs ${isToday ? 'font-bold text-brand-600' : 'text-gray-500'}`}>{day}</span>
              <div className="space-y-0.5 mt-0.5">
                {dayCards.slice(0, 3).map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onCardClick(c)}
                    className="w-full flex items-center gap-1 text-left"
                    title={c.assignee_person_id ? `${c.title} — ${memberNameById.get(c.assignee_person_id) ?? ''}` : c.title}
                  >
                    <span className={`size-1.5 rounded-full shrink-0 ${PRIORITY_DOT[c.priority]}`} />
                    <span className="text-[10px] text-gray-600 truncate">{c.title}</span>
                  </button>
                ))}
                {dayCards.length > 3 && (
                  <p className="text-[10px] text-gray-400 pl-2.5">+{dayCards.length - 3}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {withoutDueDate.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
            <CalendarDays size={12} /> Sem prazo definido ({withoutDueDate.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {withoutDueDate.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => onCardClick(c)}
                className="flex items-center gap-1 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full px-2.5 py-1 transition-colors"
              >
                <span className={`size-1.5 rounded-full shrink-0 ${PRIORITY_DOT[c.priority]}`} />
                {c.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
