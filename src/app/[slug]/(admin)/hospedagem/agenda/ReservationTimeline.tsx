'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, LogIn, LogOut, Search, UserPlus, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

// ── Types ────────────────────────────────────────────────────────────────────

type RoomRow = {
  id: string
  name: string
  blockName: string | null
  floorName: string | null
  gender: string | null
  destination: string
  allocationMode: string
  bedCount: number
}

type AllocRow = {
  id: string
  roomId: string
  bedId: string | null
  guestName: string
  guestType: string
  checkIn: string
  checkOut: string
  status: string
  schoolName: string | null
}

type BedOption = { id: string; roomId: string; label: string }
type SchoolOption = { id: string; name: string }

type Props = {
  rooms: RoomRow[]
  beds: BedOption[]
  allocs: AllocRow[]
  schools: SchoolOption[]
  today: string
  allocateAction: (fd: FormData) => Promise<void>
  allocateRoomAction: (fd: FormData) => Promise<void>
  checkinAction: (fd: FormData) => Promise<void>
  checkoutAction: (fd: FormData) => Promise<void>
  cancelAction: (fd: FormData) => Promise<void>
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

const GUEST_TYPES = [
  { value: 'visitante', label: 'Visitante' },
  { value: 'aluno', label: 'Aluno' },
  { value: 'obreiro', label: 'Obreiro' },
  { value: 'missionario', label: 'Missionário' },
  { value: 'convidado', label: 'Convidado' },
] as const

const GUEST_TYPE_LABEL: Record<string, string> = {
  visitante: 'Visitante', aluno: 'Aluno', obreiro: 'Obreiro',
  missionario: 'Missionário', convidado: 'Convidado',
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

function daysRemaining(checkOut: string, today: string): number {
  return diffDays(today, checkOut)
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function ReservationTimeline({ rooms, beds, allocs, schools, today, allocateAction, allocateRoomAction, checkinAction, checkoutAction, cancelAction }: Props) {
  const [startDate, setStartDate] = useState(today)
  const [searchFrom, setSearchFrom] = useState('')
  const [searchTo, setSearchTo] = useState('')
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false)
  const [createTarget, setCreateTarget] = useState<{ roomId: string; date: string } | null>(null)
  const [manageAlloc, setManageAlloc] = useState<AllocRow | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  function closeManageModal() {
    setManageAlloc(null)
    setConfirmingCancel(false)
  }

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
                        {(room.blockName || room.floorName) && (
                          <span className="text-[9px] text-gray-400" title={[room.blockName, room.floorName].filter(Boolean).join(' — ')}>
                            {[room.blockName, room.floorName].filter(Boolean).join(' — ')}
                          </span>
                        )}
                        {room.gender && <span className="text-[9px] text-gray-400">{GENDER_LABEL[room.gender]}</span>}
                        <span className="text-[9px] text-gray-300">{DEST_LABEL[room.destination]}</span>
                        <span className="text-[9px] text-gray-300">{room.bedCount}c</span>
                      </div>
                    </div>

                    {/* Day cells + allocation bars */}
                    <div className="relative flex-1" style={{ height: 44 }}>
                      {/* Grid lines — clicável quando o dia está livre nesse quarto, pra criar uma alocação já com quarto+data preenchidos */}
                      {days.map((day, i) => {
                        const d = new Date(day + 'T12:00:00')
                        const isToday = day === today
                        const isSunday = d.getDay() === 0
                        const free = isRoomAvailable(room.id, day, addDays(day, 1))
                        return (
                          <div
                            key={day}
                            onClick={free ? () => setCreateTarget({ roomId: room.id, date: day }) : undefined}
                            title={free ? 'Clique para alocar' : undefined}
                            className={`absolute top-0 bottom-0 border-r border-gray-50 ${
                              isToday ? 'bg-brand-50/40' : isSunday ? 'bg-red-50/20' : ''
                            } ${free ? 'cursor-pointer hover:bg-brand-50/60' : ''}`}
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
                            onClick={e => { e.stopPropagation(); setManageAlloc(a) }}
                            title={`${a.schoolName ?? a.guestName}\n${fmtShort(a.checkIn)} → ${fmtShort(a.checkOut)}\nClique para gerenciar`}
                            className={`absolute top-1.5 h-7 rounded-md ${barColor} text-white text-[10px] font-medium px-1.5 flex items-center overflow-hidden cursor-pointer hover:brightness-110 shadow-sm`}
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

      {/* ── Modal: alocar (clicou numa célula vazia) ──────────────────────── */}
      {createTarget && (() => {
        const room = rooms.find(r => r.id === createTarget.roomId)
        if (!room) return null
        const roomBeds = beds.filter(b => b.roomId === room.id)
        return (
          <Modal open onClose={() => setCreateTarget(null)} title={room.name} subtitle={fmtShort(createTarget.date)} hideFooter>
            <div className="p-5">
              {room.allocationMode === 'cama' ? (
                <form action={allocateAction} onSubmit={() => setCreateTarget(null)} className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <UserPlus size={20} />
                    <p className="text-sm font-semibold">Alocar hóspede</p>
                  </div>
                  <input type="hidden" name="room_id" value={room.id} />
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cama *</label>
                    <select name="bed_id" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                      {roomBeds.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                    <input name="guest_name" required placeholder="Nome completo" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
                      <select name="guest_type" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                        {GUEST_TYPES.filter(t => room.destination !== 'obreiro' || t.value === 'obreiro').map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Check-in *</label>
                      <input name="check_in" type="date" required defaultValue={createTarget.date} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Check-out *</label>
                    <input name="check_out" type="date" required defaultValue={addDays(createTarget.date, 1)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                  <button type="submit" className="w-full py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-colors">
                    Alocar
                  </button>
                </form>
              ) : (
                <form action={allocateRoomAction} onSubmit={() => setCreateTarget(null)} className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <UserPlus size={20} />
                    <p className="text-sm font-semibold">{room.destination === 'aluno' ? 'Alocar escola neste quarto' : 'Alocar visitante neste quarto'}</p>
                  </div>
                  <input type="hidden" name="room_id" value={room.id} />
                  {room.destination === 'aluno' && schools.length > 0 ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Escola *</label>
                        <select name="school_id" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                          <option value="">Selecione a escola...</option>
                          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <input type="hidden" name="guest_type" value="aluno" />
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nome/Identificação *</label>
                        <input name="guest_name" required placeholder="Ex: Turma ETED 2026.1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                      </div>
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="school_id" value="" />
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nome do hóspede/grupo *</label>
                        <input name="guest_name" required placeholder="Nome completo ou grupo" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                        <select name="guest_type" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                          <option value="visitante">Visitante</option>
                          <option value="convidado">Convidado</option>
                          <option value="missionario">Missionário</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Check-in *</label>
                      <input name="check_in" type="date" required defaultValue={createTarget.date} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Check-out *</label>
                      <input name="check_out" type="date" required defaultValue={addDays(createTarget.date, 1)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-colors">
                    Alocar Quarto Inteiro
                  </button>
                </form>
              )}
            </div>
          </Modal>
        )
      })()}

      {/* ── Modal: gerenciar (clicou numa barra existente) ────────────────── */}
      {manageAlloc && (() => {
        const room = rooms.find(r => r.id === manageAlloc.roomId)
        const d = daysRemaining(manageAlloc.checkOut, today)
        return (
          <Modal open onClose={closeManageModal} title={manageAlloc.schoolName ?? manageAlloc.guestName} subtitle={room?.name} hideFooter>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-500">{GUEST_TYPE_LABEL[manageAlloc.guestType] ?? manageAlloc.guestType}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 font-medium mb-0.5">Check-in</p>
                  <p className="font-semibold text-gray-900">{fmtShort(manageAlloc.checkIn)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 font-medium mb-0.5">Check-out</p>
                  <p className="font-semibold text-gray-900">{fmtShort(manageAlloc.checkOut)}</p>
                </div>
              </div>
              {d < 0 ? (
                <p className="text-sm font-bold text-red-600 text-center">{Math.abs(d)} dia(s) atrasado!</p>
              ) : d === 0 ? (
                <p className="text-sm font-bold text-red-600 text-center">Saída HOJE</p>
              ) : (
                <p className="text-sm text-blue-600 text-center font-medium">{d} dia(s) restante(s)</p>
              )}

              {!confirmingCancel ? (
                <>
                  {manageAlloc.status === 'confirmada' && (
                    <form action={checkinAction} onSubmit={closeManageModal}>
                      <input type="hidden" name="id" value={manageAlloc.id} />
                      <input type="hidden" name="bed_id" value={manageAlloc.bedId ?? ''} />
                      <button type="submit" className="w-full py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                        <LogIn size={18} /> Fazer Check-in
                      </button>
                    </form>
                  )}
                  {manageAlloc.status === 'checkin' && (
                    <form action={checkoutAction} onSubmit={closeManageModal}>
                      <input type="hidden" name="id" value={manageAlloc.id} />
                      <input type="hidden" name="bed_id" value={manageAlloc.bedId ?? ''} />
                      <button type="submit" className="w-full py-3 rounded-lg bg-gray-700 hover:bg-gray-800 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                        <LogOut size={18} /> Fazer Check-out
                      </button>
                    </form>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(true)}
                    className="w-full py-2 rounded-lg border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    Cancelar reserva
                  </button>
                </>
              ) : (
                <form action={cancelAction} onSubmit={closeManageModal} className="space-y-3 border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-700">
                    Tem certeza que quer cancelar a reserva de <strong>{manageAlloc.guestName}</strong>?
                  </p>
                  <input type="hidden" name="id" value={manageAlloc.id} />
                  <input type="hidden" name="bed_id" value={manageAlloc.bedId ?? ''} />
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Motivo do cancelamento</label>
                    <textarea
                      name="reason"
                      rows={2}
                      placeholder="Opcional"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingCancel(false)}
                      className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Voltar
                    </button>
                    <button type="submit" className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                      Confirmar cancelamento
                    </button>
                  </div>
                </form>
              )}
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
