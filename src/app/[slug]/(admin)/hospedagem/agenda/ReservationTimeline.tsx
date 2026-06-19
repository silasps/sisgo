'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type RoomRow = {
  id: string
  name: string
  block: string | null
  gender: string | null
  destination: string
  allocationMode: string
  bedCount: number
}

type AllocRow = {
  id: string
  roomId: string
  guestName: string
  guestType: string
  checkIn: string
  checkOut: string
  status: string
  schoolName: string | null
}

type Props = {
  rooms: RoomRow[]
  allocs: AllocRow[]
  today: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_W = 40
const ROOM_LABEL_W = 140
const DAYS_TO_SHOW = 21

const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const DEST_LABEL: Record<string, string> = { visita: 'Vis.', aluno: 'Aluno', obreiro: 'Obr.' }
const GENDER_LABEL: Record<string, string> = { masculino: 'M', feminino: 'F', misto: 'MF' }

const ALLOC_COLORS: Record<string, string> = {
  aluno:       'bg-indigo-400',
  obreiro:     'bg-green-400',
  visitante:   'bg-orange-400',
  missionario: 'bg-teal-400',
  convidado:   'bg-purple-400',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toKey(d)
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function diffDays(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86_400_000)
}

function fmtShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtMonth(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function ReservationTimeline({ rooms, allocs, today }: Props) {
  const [startDate, setStartDate] = useState(today)
  const [searchFrom, setSearchFrom] = useState('')
  const [searchTo, setSearchTo] = useState('')
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false)

  const days = useMemo(() =>
    Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(startDate, i)),
    [startDate]
  )

  const endDate = days[days.length - 1]

  const allocsByRoom = useMemo(() => {
    const map = new Map<string, AllocRow[]>()
    for (const a of allocs) {
      if (a.checkOut < startDate || a.checkIn > endDate) continue
      const list = map.get(a.roomId) ?? []
      list.push(a)
      map.set(a.roomId, list)
    }
    return map
  }, [allocs, startDate, endDate])

  const isRoomAvailable = (roomId: string, from: string, to: string): boolean => {
    const roomAllocs = allocsByRoom.get(roomId) ?? []
    return !roomAllocs.some(a => a.checkIn < to && a.checkOut > from)
  }

  const filteredRooms = useMemo(() => {
    if (!showOnlyAvailable || !searchFrom || !searchTo) return rooms
    return rooms.filter(r => isRoomAvailable(r.id, searchFrom, searchTo))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, showOnlyAvailable, searchFrom, searchTo, allocsByRoom])

  function shiftDays(n: number) {
    setStartDate(addDays(startDate, n))
  }

  function goToToday() {
    setStartDate(today)
  }

  const gridW = DAYS_TO_SHOW * DAY_W

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shiftDays(-7)} className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
            <ChevronLeft size={16} />
          </button>
          <button onClick={goToToday} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50">
            Hoje
          </button>
          <button onClick={() => shiftDays(7)} className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
            <ChevronRight size={16} />
          </button>
          <span className="ml-2 text-sm font-semibold text-gray-700">
            {fmtShort(startDate)} — {fmtShort(endDate)}
          </span>
        </div>

        {/* Availability search */}
        <div className="flex items-center gap-2 flex-wrap">
          <Search size={14} className="text-gray-400" />
          <input
            type="date"
            value={searchFrom}
            onChange={e => { setSearchFrom(e.target.value); setShowOnlyAvailable(!!e.target.value && !!searchTo) }}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
            title="De"
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            type="date"
            value={searchTo}
            onChange={e => { setSearchTo(e.target.value); setShowOnlyAvailable(!!searchFrom && !!e.target.value) }}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
            title="Até"
          />
          {showOnlyAvailable && (
            <button
              onClick={() => { setSearchFrom(''); setSearchTo(''); setShowOnlyAvailable(false) }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <X size={12} /> Limpar
            </button>
          )}
          {showOnlyAvailable && (
            <span className="text-xs font-medium text-green-600">
              {filteredRooms.length} quarto{filteredRooms.length !== 1 ? 's' : ''} disponível(is)
            </span>
          )}
        </div>
      </div>

      {/* Timeline grid */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: ROOM_LABEL_W + gridW }}>

            {/* Day header */}
            <div className="flex border-b border-gray-100 sticky top-0 z-10 bg-white">
              <div className="shrink-0 border-r border-gray-100 px-3 py-2 bg-gray-50" style={{ width: ROOM_LABEL_W }}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase">Quarto</p>
              </div>
              <div className="flex">
                {days.map((day, i) => {
                  const d = new Date(day + 'T12:00:00')
                  const isToday = day === today
                  const isSunday = d.getDay() === 0
                  const showMonth = i === 0 || day.endsWith('-01')
                  return (
                    <div
                      key={day}
                      className={`text-center border-r border-gray-50 py-1 ${
                        isToday ? 'bg-brand-50' : isSunday ? 'bg-red-50/30' : ''
                      }`}
                      style={{ width: DAY_W }}
                    >
                      {showMonth && (
                        <p className="text-[8px] font-bold text-gray-400 uppercase leading-none">{fmtMonth(day)}</p>
                      )}
                      <p className={`text-[9px] leading-none ${isSunday ? 'text-red-400' : 'text-gray-400'}`}>
                        {WEEKDAY_SHORT[d.getDay()]}
                      </p>
                      <p className={`text-xs font-bold leading-tight ${
                        isToday ? 'text-brand-600' : isSunday ? 'text-red-500' : 'text-gray-700'
                      }`}>
                        {d.getDate()}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Room rows */}
            {filteredRooms.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                {showOnlyAvailable
                  ? 'Nenhum quarto disponível neste período.'
                  : 'Nenhum quarto cadastrado.'}
              </div>
            ) : (
              filteredRooms.map(room => {
                const roomAllocs = allocsByRoom.get(room.id) ?? []
                const isSearchMatch = showOnlyAvailable && searchFrom && searchTo
                  ? isRoomAvailable(room.id, searchFrom, searchTo)
                  : false

                return (
                  <div
                    key={room.id}
                    className={`flex border-b border-gray-50 hover:bg-gray-50/50 ${
                      isSearchMatch ? 'bg-green-50/30' : ''
                    }`}
                  >
                    {/* Room label */}
                    <div
                      className="shrink-0 border-r border-gray-100 px-3 py-2 flex flex-col justify-center"
                      style={{ width: ROOM_LABEL_W }}
                    >
                      <p className="text-xs font-semibold text-gray-800 truncate">{room.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {room.block && <span className="text-[9px] text-gray-400">{room.block}</span>}
                        {room.gender && <span className="text-[9px] text-gray-400">{GENDER_LABEL[room.gender]}</span>}
                        <span className="text-[9px] text-gray-300">{DEST_LABEL[room.destination]}</span>
                        <span className="text-[9px] text-gray-300">{room.bedCount}c</span>
                      </div>
                    </div>

                    {/* Day cells + allocation bars */}
                    <div className="relative flex-1" style={{ height: 44 }}>
                      {/* Grid lines */}
                      {days.map((day, i) => {
                        const d = new Date(day + 'T12:00:00')
                        const isToday = day === today
                        const isSunday = d.getDay() === 0
                        return (
                          <div
                            key={day}
                            className={`absolute top-0 bottom-0 border-r border-gray-50 ${
                              isToday ? 'bg-brand-50/40' : isSunday ? 'bg-red-50/20' : ''
                            }`}
                            style={{ left: i * DAY_W, width: DAY_W }}
                          />
                        )
                      })}

                      {/* Search highlight */}
                      {showOnlyAvailable && searchFrom && searchTo && (
                        (() => {
                          const fromOffset = Math.max(diffDays(startDate, searchFrom), 0)
                          const toOffset = Math.min(diffDays(startDate, searchTo), DAYS_TO_SHOW)
                          if (toOffset <= fromOffset) return null
                          return (
                            <div
                              className="absolute top-0 bottom-0 bg-green-100/40 border-l border-r border-green-300/50"
                              style={{ left: fromOffset * DAY_W, width: (toOffset - fromOffset) * DAY_W }}
                            />
                          )
                        })()
                      )}

                      {/* Allocation bars */}
                      {roomAllocs.map(a => {
                        const fromDay = Math.max(diffDays(startDate, a.checkIn), 0)
                        const toDay = Math.min(diffDays(startDate, a.checkOut), DAYS_TO_SHOW)
                        if (toDay <= fromDay) return null
                        const barColor = ALLOC_COLORS[a.guestType] ?? 'bg-gray-400'

                        return (
                          <div
                            key={a.id}
                            title={`${a.schoolName ?? a.guestName}\n${fmtShort(a.checkIn)} → ${fmtShort(a.checkOut)}`}
                            className={`absolute top-1.5 h-7 rounded-md ${barColor} text-white text-[10px] font-medium px-1.5 flex items-center overflow-hidden cursor-default shadow-sm`}
                            style={{
                              left: fromDay * DAY_W + 2,
                              width: (toDay - fromDay) * DAY_W - 4,
                            }}
                          >
                            <span className="truncate">{a.schoolName ?? a.guestName}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] font-medium text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-indigo-400" /> Aluno</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-green-400" /> Obreiro</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-orange-400" /> Visitante</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-teal-400" /> Missionário</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-purple-400" /> Convidado</span>
      </div>
    </div>
  )
}
