'use client'

import Link from 'next/link'
import { AlertTriangle, CalendarDays, CalendarPlus, CalendarRange, ChevronLeft, ChevronRight, Clock, LayoutList, Plus, Save, Trash2, X } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'

export type CalendarLayer = 'base' | 'escola' | 'pessoal' | 'auto'
export type CalendarEventType = 'evento' | 'feriado' | 'trimestre' | 'escola' | 'aula' | 'tema' | 'nota' | 'outro'

export type CalendarEvent = {
  id: string
  title: string
  description: string | null
  event_type: CalendarEventType
  starts_on: string
  starts_at: string | null
  ends_on: string | null
  ends_at: string | null
  layer: CalendarLayer
  source: 'manual' | 'auto'
  school_id?: string | null
  school_name?: string | null
}

export type SchoolOption = { id: string; name: string }

type Action = (formData: FormData) => void | Promise<void>

type Props = {
  year: number
  slug: string
  events: CalendarEvent[]
  schoolOptions: SchoolOption[]
  permissions: {
    canManageBase: boolean
    canManageSchool: boolean
    canAddPrivateNote: boolean
  }
  actions: {
    createBaseEvent: Action
    createSchoolEvent: Action
    createPersonalNote: Action
    updateEvent: Action
    deleteEvent: Action
  }
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; layer: 'base' | 'escola' | 'pessoal'; date: string }
  | { open: true; mode: 'edit'; event: CalendarEvent }

type ViewMode = 'month' | 'week' | 'day'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const WEEKDAYS_NARROW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const WEEKDAYS_FULL   = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const EVENT_STYLE: Record<CalendarEventType, string> = {
  evento:    'bg-brand-50 text-brand-700 border-brand-100',
  feriado:   'bg-red-50 text-red-700 border-red-100',
  trimestre: 'bg-blue-50 text-blue-700 border-blue-100',
  escola:    'bg-emerald-50 text-emerald-700 border-emerald-100',
  aula:      'bg-indigo-50 text-indigo-700 border-indigo-100',
  tema:      'bg-cyan-50 text-cyan-700 border-cyan-100',
  nota:      'bg-amber-50 text-amber-800 border-amber-100',
  outro:     'bg-gray-100 text-gray-600 border-gray-200',
}

const LAYER_LABEL: Record<CalendarLayer, string> = {
  base:    'Base',
  escola:  'ETED',
  pessoal: 'Privado',
  auto:    'Auto',
}

const INPUT_CLASS = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
const NAV_BTN     = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50'
const NAV_LABEL   = 'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-900'

// ─── Main ──────────────────────────────────────────────────────────────────────

export function CalendarWorkspace({ year, slug, events, schoolOptions, permissions, actions }: Props) {
  const today = toDateKeyFromDate(new Date())
  const initialDate = today.startsWith(`${year}-`) ? today : `${year}-01-01`
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [view, setView]   = useState<ViewMode>('month')
  const [modal, setModal] = useState<ModalState>({ open: false })

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const list = map.get(event.starts_on) ?? []
      list.push(event)
      map.set(event.starts_on, list)
    }
    return map
  }, [events])

  const canCreate = permissions.canManageBase || permissions.canManageSchool || permissions.canAddPrivateNote
  const defaultLayer: 'base' | 'escola' | 'pessoal' = permissions.canManageBase ? 'base' : permissions.canManageSchool ? 'escola' : 'pessoal'
  const weekDays = getFullWeek(selectedDate)

  function openCreate(date?: string) {
    setModal({ open: true, mode: 'create', layer: defaultLayer, date: date ?? selectedDate })
  }
  function openEdit(event: CalendarEvent) {
    setModal({ open: true, mode: 'edit', event })
  }
  function shiftDate(days: number) {
    const d = new Date(`${selectedDate}T12:00:00`)
    d.setDate(d.getDate() + days)
    setSelectedDate(toDateKeyFromDate(d))
  }

  return (
    <main className="space-y-4 p-4 md:p-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Navigation — varies by view */}
          {view === 'month' && (
            <div className="flex items-center gap-1">
              <Link href={`/${slug}/calendario?ano=${year - 1}`} className={NAV_BTN}><ChevronLeft size={16} /></Link>
              <span className={NAV_LABEL}>{year}</span>
              <Link href={`/${slug}/calendario?ano=${year + 1}`} className={NAV_BTN}><ChevronRight size={16} /></Link>
            </div>
          )}
          {view === 'week' && (
            <div className="flex items-center gap-1">
              <button onClick={() => shiftDate(-7)} className={NAV_BTN}><ChevronLeft size={16} /></button>
              <span className={`${NAV_LABEL} min-w-36 text-center`}>
                {formatShortDate(weekDays[0])} – {formatShortDate(weekDays[6])}
              </span>
              <button onClick={() => shiftDate(7)} className={NAV_BTN}><ChevronRight size={16} /></button>
            </div>
          )}
          {view === 'day' && (
            <div className="flex items-center gap-1">
              <button onClick={() => shiftDate(-1)} className={NAV_BTN}><ChevronLeft size={16} /></button>
              <span className={`${NAV_LABEL} min-w-52 text-center text-xs md:text-sm`}>
                {formatLongDate(selectedDate)}
              </span>
              <button onClick={() => shiftDate(1)} className={NAV_BTN}><ChevronRight size={16} /></button>
            </div>
          )}
          <ViewToggle view={view} onChange={setView} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view === 'month' && (
            <div className="hidden flex-wrap gap-1.5 text-xs sm:flex">
              <Legend label="Base"    type="evento" />
              <Legend label="ETED"    type="aula" />
              <Legend label="Privado" type="nota" />
              <Legend label="Feriado" type="feriado" />
            </div>
          )}
          {canCreate && (
            <button
              onClick={() => openCreate()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Plus size={15} /> Novo
            </button>
          )}
        </div>
      </div>

      {/* School schedule helper — month view only */}
      {permissions.canManageSchool && view === 'month' && (
        <SchoolWeekSchedule
          initialDate={selectedDate}
          eventsByDay={eventsByDay}
          schools={schoolOptions}
          actions={actions}
        />
      )}

      {/* Views */}
      {view === 'month' && (
        <MonthView
          year={year}
          today={today}
          eventsByDay={eventsByDay}
          selectedDate={selectedDate}
          permissions={permissions}
          deleteAction={actions.deleteEvent}
          onSelectDate={setSelectedDate}
          onEditEvent={openEdit}
          onAddNew={openCreate}
          canCreate={canCreate}
        />
      )}

      {view === 'week' && (
        <WeekView
          weekDays={weekDays}
          today={today}
          selectedDate={selectedDate}
          eventsByDay={eventsByDay}
          onSelectDate={setSelectedDate}
          onGoToDay={date => { setSelectedDate(date); setView('day') }}
          onEditEvent={openEdit}
        />
      )}

      {view === 'day' && (
        <DayView
          date={selectedDate}
          today={today}
          events={eventsByDay.get(selectedDate) ?? []}
          permissions={permissions}
          deleteAction={actions.deleteEvent}
          onEditEvent={openEdit}
          onAddNew={() => openCreate()}
          canCreate={canCreate}
        />
      )}

      {modal.open && (
        <EventModal
          modal={modal}
          schoolOptions={schoolOptions}
          permissions={permissions}
          actions={actions}
          onClose={() => setModal({ open: false })}
          onChangeLayer={layer => modal.mode === 'create' && setModal({ ...modal, layer })}
        />
      )}
    </main>
  )
}

// ─── ViewToggle ────────────────────────────────────────────────────────────────

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const options: Array<{ key: ViewMode; label: string; Icon: React.ComponentType<{ size: number }> }> = [
    { key: 'month', label: 'Mês',    Icon: CalendarRange },
    { key: 'week',  label: 'Semana', Icon: CalendarDays },
    { key: 'day',   label: 'Dia',    Icon: LayoutList },
  ]
  return (
    <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white text-xs">
      {options.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 font-medium transition-colors md:gap-1.5 md:px-3 ${
            view === key ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Icon size={12} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── MonthView ─────────────────────────────────────────────────────────────────

function MonthView({
  year, today, eventsByDay, selectedDate, permissions, deleteAction,
  onSelectDate, onEditEvent, onAddNew, canCreate,
}: {
  year: number; today: string; eventsByDay: Map<string, CalendarEvent[]>
  selectedDate: string; permissions: Props['permissions']; deleteAction: Action
  onSelectDate: (d: string) => void; onEditEvent: (e: CalendarEvent) => void
  onAddNew: (d?: string) => void; canCreate: boolean
}) {
  const selectedEvents = eventsByDay.get(selectedDate) ?? []

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
      <div className="order-last grid gap-4 md:grid-cols-2 xl:order-first 2xl:grid-cols-3">
        {MONTHS.map((_, index) => (
          <MonthCard
            key={index}
            year={year}
            month={index}
            today={today}
            eventsByDay={eventsByDay}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
          />
        ))}
      </div>

      <aside className="order-first h-fit rounded-xl border border-gray-200 bg-white p-4 xl:sticky xl:top-4 xl:order-last">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dia selecionado</p>
            <h2 className="text-lg font-semibold text-gray-900">{formatLongDate(selectedDate)}</h2>
            <p className="text-xs text-gray-500">{selectedEvents.length} item(ns) neste dia</p>
          </div>
          {canCreate && (
            <button
              onClick={() => onAddNew(selectedDate)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Plus size={15} /> Novo
            </button>
          )}
        </div>

        {selectedEvents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">
            {canCreate
              ? <>Nenhum item. Clique em <strong className="text-gray-600">Novo</strong> para adicionar.</>
              : 'Nenhum item neste dia.'}
          </p>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map(event => (
              <DayEventCard
                key={`${event.layer}:${event.id}`}
                event={event}
                permissions={permissions}
                deleteAction={deleteAction}
                onEdit={() => onEditEvent(event)}
              />
            ))}
          </div>
        )}
      </aside>
    </section>
  )
}

// ─── WeekView ──────────────────────────────────────────────────────────────────

const WEEK_HOUR_START = 7
const WEEK_HOUR_END   = 22
const SLOT_H = 52 // px per hour

function WeekView({
  weekDays, today, selectedDate, eventsByDay, onSelectDate, onGoToDay, onEditEvent,
}: {
  weekDays: string[]; today: string; selectedDate: string
  eventsByDay: Map<string, CalendarEvent[]>
  onSelectDate: (d: string) => void
  onGoToDay: (d: string) => void
  onEditEvent: (e: CalendarEvent) => void
}) {
  const hours    = Array.from({ length: WEEK_HOUR_END - WEEK_HOUR_START }, (_, i) => WEEK_HOUR_START + i)
  const gridH    = hours.length * SLOT_H
  const hasAllDay = weekDays.some(day => (eventsByDay.get(day) ?? []).some(e => !e.starts_at))

  function eventPos(event: CalendarEvent) {
    const s = new Date(event.starts_at!)
    const startMin = Math.max((s.getHours() - WEEK_HOUR_START) * 60 + s.getMinutes(), 0)
    let durationMin = 60
    if (event.ends_at) {
      const e = new Date(event.ends_at)
      const endMin = (e.getHours() - WEEK_HOUR_START) * 60 + e.getMinutes()
      durationMin = Math.max(endMin - startMin, 30)
    }
    return { top: startMin * SLOT_H / 60, height: Math.max(durationMin * SLOT_H / 60, 22) }
  }

  return (
    <div className="-mx-4 overflow-x-auto rounded-xl border border-gray-200 bg-white md:mx-0">
      <div className="min-w-[560px]">

        {/* Day headers */}
        <div className="flex border-b border-gray-100">
          <div className="w-14 shrink-0" />
          {weekDays.map(day => {
            const isToday    = day === today
            const isSelected = day === selectedDate
            const dayNum     = parseInt(day.slice(8))
            return (
              <button
                key={day}
                onClick={() => onSelectDate(day)}
                className={`flex-1 border-l border-gray-100 py-2 text-center transition-colors ${
                  isSelected ? 'bg-brand-50/40' : 'hover:bg-gray-50'
                }`}
              >
                <p className="text-[10px] font-medium uppercase tracking-widest text-gray-400">
                  {WEEKDAYS_FULL[new Date(`${day}T12:00:00`).getDay()]}
                </p>
                {/* Number — click here to go to day view */}
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); onGoToDay(day) }}
                  title="Ver dia completo"
                  className={`mx-auto mt-0.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    isToday ? 'bg-brand-500 text-white' : 'text-gray-700 hover:bg-brand-100 hover:text-brand-700'
                  }`}
                >
                  {dayNum}
                </span>
              </button>
            )
          })}
        </div>

        {/* All-day events */}
        {hasAllDay && (
          <div className="flex border-b border-gray-100">
            <div className="w-14 shrink-0 flex items-center justify-end pr-2 py-1">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-300">Dia todo</span>
            </div>
            {weekDays.map(day => {
              const allDay = (eventsByDay.get(day) ?? []).filter(e => !e.starts_at)
              return (
                <div key={day} className="flex-1 border-l border-gray-100 space-y-0.5 p-1 min-h-8">
                  {allDay.map(event => (
                    <button
                      key={`${event.layer}:${event.id}`}
                      onClick={() => onEditEvent(event)}
                      className={`w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] hover:opacity-80 ${EVENT_STYLE[event.event_type]}`}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* Time grid */}
        <div className="flex overflow-y-auto" style={{ maxHeight: '520px' }}>
          {/* Hour labels */}
          <div className="w-14 shrink-0 relative" style={{ height: gridH }}>
            {hours.map((h, i) => (
              <div
                key={h}
                style={{ height: SLOT_H, top: i * SLOT_H }}
                className="absolute w-14 flex items-start justify-end pr-2 pt-0.5"
              >
                <span className="text-[10px] tabular-nums text-gray-400">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map(day => {
            const timed      = (eventsByDay.get(day) ?? []).filter(e => !!e.starts_at)
            const isSelected = day === selectedDate
            return (
              <div
                key={day}
                onClick={() => onSelectDate(day)}
                className={`relative flex-1 cursor-pointer border-l border-gray-100 transition-colors ${
                  isSelected ? 'bg-brand-50/20' : 'hover:bg-gray-50/60'
                }`}
                style={{ height: gridH }}
              >
                {/* Hour grid lines */}
                {hours.map((_, i) => (
                  <div key={i} style={{ top: i * SLOT_H }} className="absolute left-0 right-0 border-t border-gray-100" />
                ))}
                {/* Half-hour lines */}
                {hours.map((_, i) => (
                  <div key={`h${i}`} style={{ top: i * SLOT_H + SLOT_H / 2 }} className="absolute left-0 right-0 border-t border-dashed border-gray-50" />
                ))}

                {/* Events */}
                {timed.map(event => {
                  const { top, height } = eventPos(event)
                  return (
                    <button
                      key={`${event.layer}:${event.id}`}
                      onClick={e => { e.stopPropagation(); onEditEvent(event) }}
                      title={event.title}
                      style={{ top, height, left: 2, right: 2 }}
                      className={`absolute overflow-hidden rounded border px-1 py-0.5 text-left text-[10px] leading-tight transition-opacity hover:opacity-75 ${EVENT_STYLE[event.event_type]}`}
                    >
                      <span className="block font-semibold">{formatTime(event.starts_at!)}</span>
                      <span className="block truncate">{event.title}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}

// ─── DayView ───────────────────────────────────────────────────────────────────

function DayView({
  date, today, events, permissions, deleteAction, onEditEvent, onAddNew, canCreate,
}: {
  date: string; today: string; events: CalendarEvent[]
  permissions: Props['permissions']; deleteAction: Action
  onEditEvent: (e: CalendarEvent) => void; onAddNew: () => void; canCreate: boolean
}) {
  const allDay = events.filter(e => !e.starts_at)
  const timed  = events.filter(e => !!e.starts_at).sort((a, b) =>
    (a.starts_at ?? '').localeCompare(b.starts_at ?? '')
  )

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {date === today && (
        <p className="rounded-lg bg-brand-50 px-3 py-1.5 text-center text-xs font-semibold text-brand-700">Hoje</p>
      )}

      {allDay.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">O dia todo</p>
          <div className="space-y-2">
            {allDay.map(event => (
              <DayEventCard
                key={`${event.layer}:${event.id}`}
                event={event}
                permissions={permissions}
                deleteAction={deleteAction}
                onEdit={() => onEditEvent(event)}
              />
            ))}
          </div>
        </div>
      )}

      {timed.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Com horário</p>
          <div className="space-y-2">
            {timed.map(event => (
              <div key={`${event.layer}:${event.id}`} className="flex items-start gap-3">
                <div className="w-11 shrink-0 pt-3 text-right text-xs font-semibold tabular-nums text-gray-400">
                  {formatTime(event.starts_at!)}
                </div>
                <div className="flex-1">
                  <DayEventCard
                    event={event}
                    permissions={permissions}
                    deleteAction={deleteAction}
                    onEdit={() => onEditEvent(event)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-14 text-center">
          <p className="text-sm text-gray-400">Nenhum item neste dia.</p>
          {canCreate && (
            <button onClick={onAddNew} className="mt-2 text-sm font-semibold text-brand-600 hover:underline">
              + Adicionar evento
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SchoolWeekSchedule ────────────────────────────────────────────────────────

function SchoolWeekSchedule({
  initialDate, eventsByDay, schools, actions,
}: {
  initialDate: string; eventsByDay: Map<string, CalendarEvent[]>
  schools: SchoolOption[]; actions: Props['actions']
}) {
  const [anchorDate, setAnchorDate] = useState(() => getWeekDays(initialDate)[0])
  const [openDay, setOpenDay]       = useState<string | null>(null)
  const weekDays = getWeekDays(anchorDate)
  const today    = toDateKeyFromDate(new Date())

  function shiftWeek(dir: number) {
    const d = new Date(`${anchorDate}T12:00:00`)
    d.setDate(d.getDate() + dir * 7)
    setAnchorDate(toDateKeyFromDate(d))
  }

  return (
    <section className="rounded-xl border border-indigo-100 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Clock size={18} className="text-indigo-600" />
          Semana da ETED
        </h2>
        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => shiftWeek(-1)} className={NAV_BTN} title="Semana anterior"><ChevronLeft size={15} /></button>
          <span className={`${NAV_LABEL} min-w-40 text-center text-xs`}>
            {formatShortDate(weekDays[0])} – {formatShortDate(weekDays[weekDays.length - 1])}
          </span>
          <button onClick={() => shiftWeek(1)} className={NAV_BTN} title="Próxima semana"><ChevronRight size={15} /></button>
        </div>
      </div>

      {schools.length === 0 ? (
        <p className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-4 text-sm text-indigo-800">
          Este usuário está como líder de ETED, mas ainda não há escola vinculada.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {weekDays.map(day => {
            const schoolEvents = (eventsByDay.get(day) ?? [])
              .filter(e => e.layer === 'escola')
              .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''))
            const isToday = day === today

            return (
              <button
                key={day}
                onClick={() => setOpenDay(day)}
                className={`rounded-xl border p-3 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  isToday ? 'border-indigo-300 bg-indigo-50/60' : 'border-gray-200 bg-gray-50 hover:border-indigo-200'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{weekdayName(day)}</p>
                    <p className={`text-sm font-bold ${isToday ? 'text-indigo-700' : 'text-gray-900'}`}>
                      {formatShortDate(day)}
                    </p>
                  </div>
                  {schoolEvents.length > 0 && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {schoolEvents.length}
                    </span>
                  )}
                </div>
                {schoolEvents.length === 0 ? (
                  <p className="text-xs text-gray-400">+ adicionar aula</p>
                ) : (
                  <div className="space-y-1">
                    {schoolEvents.slice(0, 3).map(e => (
                      <div key={e.id} className={`truncate rounded border px-1.5 py-0.5 text-[10px] ${EVENT_STYLE[e.event_type]}`}>
                        {e.starts_at && <span className="mr-0.5 font-semibold">{formatTime(e.starts_at)}</span>}
                        {e.title}
                      </div>
                    ))}
                    {schoolEvents.length > 3 && (
                      <p className="text-[10px] text-gray-400">+{schoolEvents.length - 3} mais</p>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {openDay && (
        <SchoolDayModal
          day={openDay}
          weekDays={weekDays}
          schools={schools}
          eventsByDay={eventsByDay}
          actions={actions}
          onClose={() => setOpenDay(null)}
          onChangeDay={setOpenDay}
        />
      )}
    </section>
  )
}

// ─── SchoolDayModal ────────────────────────────────────────────────────────────

function SchoolDayModal({
  day, weekDays, schools, eventsByDay, actions, onClose, onChangeDay,
}: {
  day: string; weekDays: string[]; schools: SchoolOption[]
  eventsByDay: Map<string, CalendarEvent[]>
  actions: Props['actions']; onClose: () => void; onChangeDay: (d: string) => void
}) {
  const [conflict, setConflict]   = useState<CalendarEvent | null>(null)
  const [pendingFd, setPendingFd] = useState<FormData | null>(null)
  const [isPending, startTransition] = useTransition()

  const dayIndex   = weekDays.indexOf(day)
  const allEvents  = eventsByDay.get(day) ?? []
  const schoolEvts = allEvents
    .filter(e => e.layer === 'escola')
    .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''))

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    // Conflict detection against all events on this day
    const startsVal = fd.get('starts_at') as string
    const endsVal   = fd.get('ends_at')   as string
    if (startsVal) {
      const newStart = new Date(startsVal)
      const newEnd   = endsVal ? new Date(endsVal) : new Date(newStart.getTime() + 60 * 60000)

      const hit = allEvents.find(ev => {
        if (!ev.starts_at) return false
        const evStart = new Date(ev.starts_at)
        const evEnd   = ev.ends_at ? new Date(ev.ends_at) : new Date(evStart.getTime() + 60 * 60000)
        return newStart < evEnd && newEnd > evStart
      })

      if (hit) {
        setConflict(hit)
        setPendingFd(fd)
        return
      }
    }

    doSubmit(fd)
  }

  function doSubmit(fd: FormData) {
    setConflict(null)
    startTransition(async () => { await actions.createSchoolEvent(fd) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>

        {/* Header with day nav */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          <button
            onClick={() => dayIndex > 0 && onChangeDay(weekDays[dayIndex - 1])}
            disabled={dayIndex <= 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 disabled:opacity-30 hover:bg-gray-50"
          >
            <ChevronLeft size={15} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{weekdayName(day)}</p>
            <p className="text-sm font-semibold text-gray-900">{formatLongDate(day)}</p>
          </div>
          <button
            onClick={() => dayIndex < weekDays.length - 1 && onChangeDay(weekDays[dayIndex + 1])}
            disabled={dayIndex >= weekDays.length - 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 disabled:opacity-30 hover:bg-gray-50"
          >
            <ChevronRight size={15} />
          </button>
          <button onClick={onClose} className="ml-1 rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Existing school events for this day */}
        {schoolEvts.length > 0 && (
          <div className="border-b border-gray-100 px-5 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Já agendado</p>
            <div className="space-y-1.5">
              {schoolEvts.map(event => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${EVENT_STYLE[event.event_type]}`}
                >
                  <span className="truncate">
                    {event.starts_at && <span className="mr-1.5 font-semibold">{formatTime(event.starts_at)}</span>}
                    {event.title}
                  </span>
                  <form action={actions.deleteEvent} className="ml-2 shrink-0">
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="layer"    value={event.layer} />
                    <button className="rounded p-1 opacity-60 hover:opacity-100 hover:text-red-600" title="Remover">
                      <Trash2 size={13} />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add form — key=day forces reset when day changes */}
        <form key={day} onSubmit={handleSubmit} className="space-y-3 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Nova aula</p>
          <input name="title" required placeholder="Título da aula / tema" className={INPUT_CLASS} />
          {schools.length > 0 && (
            <FieldSelect name="school_id" options={schools.map(s => ({ value: s.id, label: s.name }))} />
          )}
          <FieldSelect name="event_type" defaultValue="aula" options={[
            { value: 'aula',   label: 'Aula' },
            { value: 'tema',   label: 'Tema da semana' },
            { value: 'evento', label: 'Evento da ETED' },
            { value: 'outro',  label: 'Outro' },
          ]} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Início</label>
              <input name="starts_at" type="datetime-local" required defaultValue={`${day}T09:00`} className={INPUT_CLASS} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Fim</label>
              <input name="ends_at" type="datetime-local" defaultValue={`${day}T12:00`} className={INPUT_CLASS} />
            </div>
          </div>
          <input name="description" placeholder="Professor, sala ou obs. (opcional)" className={INPUT_CLASS} />

          {/* Conflict warning */}
          {conflict ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800">Conflito de horário</p>
                  <p className="mt-0.5 text-xs text-amber-700 truncate">
                    <strong>&ldquo;{conflict.title}&rdquo;</strong>
                    {conflict.starts_at && ` (${formatTime(conflict.starts_at)})`} já está agendado.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setConflict(null); setPendingFd(null) }}
                  className="flex-1 rounded-lg border border-amber-200 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => pendingFd && doSubmit(pendingFd)}
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-amber-500 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {isPending ? 'Salvando…' : 'Salvar mesmo assim'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              <Save size={14} /> {isPending ? 'Salvando…' : 'Salvar aula'}
            </button>
          )}
        </form>

      </div>
    </div>
  )
}

// ─── MonthCard ─────────────────────────────────────────────────────────────────

function MonthCard({
  year, month, today, eventsByDay, selectedDate, onSelectDate,
}: {
  year: number; month: number; today: string
  eventsByDay: Map<string, CalendarEvent[]>
  selectedDate: string; onSelectDate: (d: string) => void
}) {
  const firstDay   = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const blanks = Array.from({ length: firstDay.getDay() })
  const days   = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-3 font-semibold text-gray-900">{MONTHS[month]}</h2>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-400">
        {WEEKDAYS_NARROW.map((d, i) => <div key={`${d}-${i}`}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {blanks.map((_, i) => <div key={`blank-${i}`} />)}
        {days.map(day => {
          const date      = toDateKey(year, month, day)
          const dayEvents = eventsByDay.get(date) ?? []
          const selected  = selectedDate === date
          const isToday   = today === date
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`min-h-16 rounded-lg border p-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                selected ? 'border-brand-400 bg-brand-50/70 shadow-sm' : 'border-gray-100 hover:border-brand-200 hover:bg-gray-50'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                isToday ? 'bg-brand-500 text-white' : selected ? 'text-brand-700' : 'text-gray-500'
              }`}>
                {day}
              </span>
              <span className="mt-1 block space-y-px">
                {dayEvents.slice(0, 3).map(event => (
                  <span
                    key={`${event.layer}:${event.id}`}
                    className={`block truncate rounded border px-1 py-px text-[10px] ${EVENT_STYLE[event.event_type]}`}
                    title={event.title}
                  >
                    {event.starts_at ? `${formatTime(event.starts_at)} ` : ''}{event.title}
                  </span>
                ))}
                {dayEvents.length > 3 && <span className="block text-[10px] text-gray-400">+{dayEvents.length - 3}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── DayEventCard ──────────────────────────────────────────────────────────────

function DayEventCard({
  event, permissions, deleteAction, onEdit,
}: {
  event: CalendarEvent; permissions: Props['permissions']; deleteAction: Action; onEdit: () => void
}) {
  const editable = canEdit(event, permissions)

  return (
    <div className={`rounded-lg border p-3 ${EVENT_STYLE[event.event_type]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-semibold">{formatEventDate(event)}</p>
            <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium">{LAYER_LABEL[event.layer]}</span>
          </div>
          {event.school_name && <p className="mt-0.5 text-[11px] font-medium opacity-75">{event.school_name}</p>}
          <p className="mt-0.5 text-sm font-semibold leading-snug">{event.title}</p>
          {event.description && <p className="mt-1 text-xs opacity-80">{event.description}</p>}
        </div>
        {editable && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/70 text-gray-600 transition-colors hover:bg-white"
              title="Editar"
            >
              <CalendarPlus size={14} />
            </button>
            <form action={deleteAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <input type="hidden" name="layer"    value={event.layer} />
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/70 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Remover"
              >
                <Trash2 size={14} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── EventModal ────────────────────────────────────────────────────────────────

function EventModal({
  modal, schoolOptions, permissions, actions, onClose, onChangeLayer,
}: {
  modal: Extract<ModalState, { open: true }>
  schoolOptions: SchoolOption[]; permissions: Props['permissions']
  actions: Props['actions']
  onClose: () => void; onChangeLayer: (l: 'base' | 'escola' | 'pessoal') => void
}) {
  const isCreate = modal.mode === 'create'
  const currentLayer = isCreate ? modal.layer : modal.event.layer as 'base' | 'escola' | 'pessoal'

  const availableLayers: Array<{ key: 'base' | 'escola' | 'pessoal'; label: string }> = [
    ...(permissions.canManageBase ? [{ key: 'base' as const, label: 'Base' }] : []),
    ...(permissions.canManageSchool || permissions.canManageBase ? [{ key: 'escola' as const, label: 'ETED' }] : []),
    { key: 'pessoal' as const, label: 'Privado' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">{isCreate ? 'Novo item' : 'Editar item'}</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {isCreate ? formatLongDate(modal.date) : formatLongDate(modal.event.starts_on)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {isCreate && availableLayers.length > 1 && (
          <div className="flex gap-1 border-b border-gray-100 bg-gray-50 px-4 py-2">
            {availableLayers.map(l => (
              <button
                key={l.key}
                type="button"
                onClick={() => onChangeLayer(l.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  currentLayer === l.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}

        <div className="p-5">
          {isCreate && currentLayer === 'base' && permissions.canManageBase && (
            <form action={actions.createBaseEvent} className="space-y-3">
              <input type="hidden" name="starts_on" value={modal.date} />
              <FieldInput name="title" placeholder="Título do evento" required />
              <FieldSelect name="event_type" defaultValue="evento" options={[
                { value: 'evento',    label: 'Evento da base' },
                { value: 'trimestre', label: 'Início de trimestre' },
                { value: 'feriado',   label: 'Feriado' },
                { value: 'outro',     label: 'Outro' },
              ]} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Início</label>
                  <input type="date" name="starts_on" defaultValue={modal.date} required className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Fim (opcional)</label>
                  <input type="date" name="ends_on" min={modal.date} className={INPUT_CLASS} />
                </div>
              </div>
              <FieldInput name="description" placeholder="Observação (opcional)" />
              <SubmitButton label="Adicionar" />
            </form>
          )}

          {isCreate && currentLayer === 'escola' && (permissions.canManageBase || permissions.canManageSchool) && (
            <form action={actions.createSchoolEvent} className="space-y-3">
              <FieldInput name="title" placeholder="Aula, tema ou atividade" required />
              {schoolOptions.length > 0 && (
                <FieldSelect name="school_id" options={schoolOptions.map(s => ({ value: s.id, label: s.name }))} />
              )}
              <FieldSelect name="event_type" defaultValue="aula" options={[
                { value: 'aula',   label: 'Aula' },
                { value: 'tema',   label: 'Tema da semana' },
                { value: 'evento', label: 'Evento da ETED' },
                { value: 'outro',  label: 'Outro' },
              ]} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Início</label>
                  <input name="starts_at" type="datetime-local" required defaultValue={`${modal.date}T09:00`} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Fim</label>
                  <input name="ends_at" type="datetime-local" defaultValue={`${modal.date}T12:00`} className={INPUT_CLASS} />
                </div>
              </div>
              <FieldInput name="description" placeholder="Professor, sala ou observação" />
              <SubmitButton label="Adicionar" />
            </form>
          )}

          {isCreate && currentLayer === 'pessoal' && (
            <form action={actions.createPersonalNote} className="space-y-3">
              <FieldInput name="title" placeholder="Título da anotação" required />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Início</label>
                  <input name="starts_at" type="datetime-local" required defaultValue={`${modal.date}T09:00`} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Fim</label>
                  <input name="ends_at" type="datetime-local" className={INPUT_CLASS} />
                </div>
              </div>
              <textarea name="notes" rows={3} placeholder="Anotação privada..." className={`${INPUT_CLASS} resize-none`} />
              <SubmitButton label="Salvar" />
            </form>
          )}

          {!isCreate && (
            <EditEventForm
              event={modal.event}
              schools={schoolOptions}
              updateAction={actions.updateEvent}
              deleteAction={actions.deleteEvent}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── EditEventForm ─────────────────────────────────────────────────────────────

function EditEventForm({ event, schools, updateAction, deleteAction }: {
  event: CalendarEvent; schools: SchoolOption[]; updateAction: Action; deleteAction: Action
}) {
  const formId = `calendar-edit-${event.layer}-${event.id}`
  const deleteBtn = (
    <form action={deleteAction}>
      <input type="hidden" name="event_id" value={event.id} />
      <input type="hidden" name="layer"    value={event.layer} />
      <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50">
        <Trash2 size={14} /> Excluir
      </button>
    </form>
  )
  const actionsRow = (
    <div className="flex gap-2 pt-1">
      {deleteBtn}
      <SubmitButton label="Salvar" form={formId} />
    </div>
  )

  if (event.layer === 'base') {
    return (
      <div className="space-y-3">
        <form id={formId} action={updateAction} className="space-y-3">
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="layer"    value={event.layer} />
          <FieldInput name="title" required defaultValue={event.title} placeholder="Título" />
          <FieldSelect name="event_type" defaultValue={event.event_type} options={[
            { value: 'evento',    label: 'Evento da base' },
            { value: 'trimestre', label: 'Início de trimestre' },
            { value: 'feriado',   label: 'Feriado' },
            { value: 'outro',     label: 'Outro' },
          ]} />
          <div className="grid grid-cols-2 gap-2">
            <input name="starts_on" type="date" required defaultValue={event.starts_on} className={INPUT_CLASS} />
            <input name="ends_on"   type="date"         defaultValue={event.ends_on ?? ''} className={INPUT_CLASS} />
          </div>
          <FieldInput name="description" defaultValue={event.description ?? ''} placeholder="Observação" />
        </form>
        {actionsRow}
      </div>
    )
  }

  if (event.layer === 'escola') {
    return (
      <div className="space-y-3">
        <form id={formId} action={updateAction} className="space-y-3">
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="layer"    value={event.layer} />
          <FieldInput name="title" required defaultValue={event.title} placeholder="Título" />
          {schools.length > 0 && (
            <FieldSelect name="school_id" defaultValue={event.school_id ?? ''} options={schools.map(s => ({ value: s.id, label: s.name }))} />
          )}
          <FieldSelect name="event_type" defaultValue={event.event_type} options={[
            { value: 'aula',   label: 'Aula' },
            { value: 'tema',   label: 'Tema da semana' },
            { value: 'evento', label: 'Evento da ETED' },
            { value: 'outro',  label: 'Outro' },
          ]} />
          <div className="grid grid-cols-2 gap-2">
            <input name="starts_at" type="datetime-local" required defaultValue={event.starts_at ? isoToLocalInput(event.starts_at) : ''} className={INPUT_CLASS} />
            <input name="ends_at"   type="datetime-local"         defaultValue={event.ends_at   ? isoToLocalInput(event.ends_at)   : ''} className={INPUT_CLASS} />
          </div>
          <FieldInput name="description" defaultValue={event.description ?? ''} placeholder="Professor, sala ou observação" />
        </form>
        {actionsRow}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <form id={formId} action={updateAction} className="space-y-3">
        <input type="hidden" name="event_id" value={event.id} />
        <input type="hidden" name="layer"    value={event.layer} />
        <FieldInput name="title" required defaultValue={event.title} placeholder="Título" />
        <div className="grid grid-cols-2 gap-2">
          <input name="starts_at" type="datetime-local" required defaultValue={event.starts_at ? isoToLocalInput(event.starts_at) : ''} className={INPUT_CLASS} />
          <input name="ends_at"   type="datetime-local"         defaultValue={event.ends_at   ? isoToLocalInput(event.ends_at)   : ''} className={INPUT_CLASS} />
        </div>
        <textarea name="notes" rows={3} defaultValue={event.description ?? ''} className={`${INPUT_CLASS} resize-none`} />
      </form>
      {actionsRow}
    </div>
  )
}

// ─── Atoms ─────────────────────────────────────────────────────────────────────

function FieldInput({ name, placeholder, required, defaultValue }: {
  name: string; placeholder?: string; required?: boolean; defaultValue?: string
}) {
  return <input name={name} placeholder={placeholder} required={required} defaultValue={defaultValue} className={INPUT_CLASS} />
}

function FieldSelect({ name, defaultValue, options }: {
  name: string; defaultValue?: string; options: Array<{ value: string; label: string }>
}) {
  return (
    <select name={name} defaultValue={defaultValue} className={INPUT_CLASS}>
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  )
}

function SubmitButton({ label, small = false, form }: { label: string; small?: boolean; form?: string }) {
  return (
    <button type="submit" form={form} className={`inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 font-semibold text-white transition-colors hover:bg-brand-600 ${small ? 'px-3 py-2 text-xs' : 'px-4 py-2 text-sm'}`}>
      <Save size={small ? 13 : 15} /> {label}
    </button>
  )
}

function Legend({ label, type }: { label: string; type: CalendarEventType }) {
  return <span className={`rounded-full border px-2 py-1 ${EVENT_STYLE[type]}`}>{label}</span>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function canEdit(event: CalendarEvent, permissions: Props['permissions']) {
  if (event.source !== 'manual') return false
  if (event.layer === 'base')    return permissions.canManageBase
  if (event.layer === 'escola')  return permissions.canManageBase || permissions.canManageSchool
  if (event.layer === 'pessoal') return permissions.canAddPrivateNote
  return false
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function toDateKeyFromDate(date: Date) {
  return toDateKey(date.getFullYear(), date.getMonth(), date.getDate())
}

function getWeekDays(dateKey: string): string[] {
  const date = new Date(`${dateKey}T12:00:00`)
  const day  = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  return Array.from({ length: 6 }, (_, i) => {
    const next = new Date(monday)
    next.setDate(monday.getDate() + i)
    return toDateKeyFromDate(next)
  })
}

function getFullWeek(dateKey: string): string[] {
  const date   = new Date(`${dateKey}T12:00:00`)
  const sunday = new Date(date)
  sunday.setDate(date.getDate() - date.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    return toDateKeyFromDate(d)
  })
}

function isoToLocalInput(value: string) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function formatLongDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
}

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function weekdayName(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' })
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatEventDate(event: CalendarEvent) {
  const date = formatDate(event.starts_on)
  const time = event.starts_at ? `, ${formatTime(event.starts_at)}` : ''
  const end  = event.ends_at
    ? ` até ${formatDate(event.ends_at.slice(0, 10))}, ${formatTime(event.ends_at)}`
    : event.ends_on
      ? ` até ${formatDate(event.ends_on)}`
      : ''
  return `${date}${time}${end}`
}
