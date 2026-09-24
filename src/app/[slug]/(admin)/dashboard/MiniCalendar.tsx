'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarDays, ArrowUpRight } from 'lucide-react'
import type { CalendarEventRow } from './areas'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const TYPE_DOT: Record<string, string> = {
  reuniao: 'bg-blue-500',
  devocional: 'bg-purple-500',
  evento: 'bg-brand-500',
  outro: 'bg-gray-400',
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function MiniCalendar({ slug, events }: { slug: string; events: CalendarEventRow[] }) {
  const today = useMemo(() => new Date(), [])
  const [offset, setOffset] = useState(0) // meses a partir de hoje — janela buscada no servidor é -1 a +2

  const viewDate = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = new Date(year, month, 1).getDay()
  const todayStr = today.toISOString().slice(0, 10)

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>()
    for (const e of events) {
      const day = new Date(e.starts_at).toISOString().slice(0, 10)
      map.set(day, [...(map.get(day) ?? []), e])
    }
    return map
  }, [events])

  const monthEvents = events
    .filter(e => monthKey(new Date(e.starts_at)) === monthKey(viewDate))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800 capitalize">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset(o => Math.max(-1, o - 1))}
            disabled={offset <= -1}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setOffset(o => Math.min(2, o + 1))}
            disabled={offset >= 2}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-[10px] font-medium text-gray-400">{d}</span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayEvents = eventsByDay.get(dateStr) ?? []
          const isToday = dateStr === todayStr
          return (
            <div key={i} className="flex flex-col items-center gap-0.5 py-0.5">
              <span className={`text-xs h-6 w-6 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-500 text-white font-semibold' : 'text-gray-600'}`}>
                {day}
              </span>
              <span className="flex gap-0.5 h-1">
                {dayEvents.slice(0, 3).map(e => (
                  <span key={e.id} className={`size-1 rounded-full ${TYPE_DOT[e.event_type] ?? TYPE_DOT.outro}`} />
                ))}
              </span>
            </div>
          )
        })}
      </div>

      <div className="border-t border-gray-100 pt-2 space-y-1.5">
        {monthEvents.length === 0 ? (
          <p className="text-xs text-gray-400 flex items-center gap-1.5 py-1">
            <CalendarDays size={12} /> Nenhum evento neste mês.
          </p>
        ) : (
          monthEvents.map(e => (
            <div key={e.id} className="flex items-center gap-2 text-xs">
              <span className={`size-1.5 rounded-full shrink-0 ${TYPE_DOT[e.event_type] ?? TYPE_DOT.outro}`} />
              <span className="text-gray-400 shrink-0 tabular-nums">
                {new Date(e.starts_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
              <span className="text-gray-700 truncate">{e.title}</span>
            </div>
          ))
        )}
      </div>

      <Link
        href={`/${slug}/calendario`}
        className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 pt-1"
      >
        Ver calendário completo e gerenciar <ArrowUpRight size={12} />
      </Link>
    </div>
  )
}
