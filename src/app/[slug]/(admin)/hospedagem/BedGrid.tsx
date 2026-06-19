'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { AlertTriangle, BedDouble, Building2, GraduationCap, LogIn, LogOut, UserPlus, Users, Wrench } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type BedData = {
  id: string
  roomId: string
  roomName: string
  roomFloor: string | null
  roomGender: string | null
  label: string
  type: string
  status: string
}

type AllocData = {
  id: string
  bedId: string | null
  roomId: string
  guestName: string
  guestType: string
  checkIn: string
  checkOut: string
  allocStatus: string
  schoolName: string | null
}

type RoomData = {
  id: string
  name: string
  floor: string | null
  block: string | null
  gender: string | null
  destination: string
  allocationMode: string
  status: string
}

type SchoolOption = { id: string; name: string }

type Props = {
  rooms: RoomData[]
  beds: BedData[]
  allocs: AllocData[]
  schools: SchoolOption[]
  today: string
  advanceHours: number
  slug: string
  allocateAction: (fd: FormData) => Promise<void>
  allocateRoomAction: (fd: FormData) => Promise<void>
  checkinAction: (fd: FormData) => Promise<void>
  checkoutAction: (fd: FormData) => Promise<void>
  checkinRoomAction: (fd: FormData) => Promise<void>
  checkoutRoomAction: (fd: FormData) => Promise<void>
  toggleRoomMaintenanceAction: (fd: FormData) => Promise<void>
  toggleBedMaintenanceAction: (fd: FormData) => Promise<void>
}

// ── Constants ────────────────────────────────────────────────────────────────

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

const DEST_LABEL: Record<string, string> = { visita: 'Visitantes', aluno: 'Alunos', obreiro: 'Obreiros' }
const DEST_CLS: Record<string, string> = { visita: 'text-orange-500', aluno: 'text-indigo-500', obreiro: 'text-green-500' }
const DEST_ICON: Record<string, typeof Users> = { visita: Users, aluno: GraduationCap, obreiro: Building2 }

const GENDER_LABEL: Record<string, string> = { masculino: 'Masc.', feminino: 'Fem.', misto: 'Misto' }
const GENDER_CLS: Record<string, string> = { masculino: 'text-blue-500', feminino: 'text-pink-500', misto: 'text-purple-500' }

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysRemaining(checkOut: string, today: string): number {
  return Math.ceil((new Date(checkOut + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000)
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

// ── RoomCard (modo quarto inteiro) ───────────────────────────────────────────

function RoomCard({ room, roomBeds, roomAllocs, today, onClick }: {
  room: RoomData; roomBeds: BedData[]; roomAllocs: AllocData[]; today: string; onClick: () => void
}) {
  const isMaintenance = room.status === 'manutencao'
  const activeBeds = roomBeds.filter(b => b.status !== 'manutencao')
  const occupiedBeds = roomBeds.filter(b => b.status === 'ocupada')
  const isOccupied = occupiedBeds.length > 0
  const firstAlloc = roomAllocs[0]
  const days = firstAlloc ? daysRemaining(firstAlloc.checkOut, today) : 0
  const isCheckoutToday = firstAlloc && firstAlloc.checkOut === today
  const isOverdue = firstAlloc && days < 0
  const needsCheckin = firstAlloc && firstAlloc.allocStatus === 'confirmada'

  let borderColor = 'border-green-300'
  let bgColor = 'bg-green-50/60'

  if (isMaintenance) { borderColor = 'border-yellow-300'; bgColor = 'bg-yellow-50/60' }
  else if (isOverdue) { borderColor = 'border-red-400'; bgColor = 'bg-red-50' }
  else if (isCheckoutToday) { borderColor = 'border-red-300'; bgColor = 'bg-red-50/60' }
  else if (needsCheckin) { borderColor = 'border-purple-300'; bgColor = 'bg-purple-50/60' }
  else if (isOccupied) { borderColor = 'border-blue-300'; bgColor = 'bg-blue-50/60' }

  const DestIcon = DEST_ICON[room.destination] ?? Users

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left w-full p-4 rounded-lg border-2 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${borderColor} ${bgColor}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold text-gray-800 truncate">{room.name}</span>
        <DestIcon size={14} className={DEST_CLS[room.destination] ?? 'text-gray-400'} />
      </div>

      <p className="text-[10px] text-gray-400 mb-2">
        {activeBeds.length} cama{activeBeds.length !== 1 ? 's' : ''}
        {room.gender && ` · ${GENDER_LABEL[room.gender]}`}
      </p>

      {isMaintenance ? (
        <p className="text-xs text-yellow-600 flex items-center gap-1"><Wrench size={12} /> Manutenção</p>
      ) : isOccupied && firstAlloc ? (
        <>
          <p className="text-sm font-medium text-gray-900 truncate">
            {firstAlloc.schoolName ?? firstAlloc.guestName}
          </p>
          {needsCheckin ? (
            <p className="text-[10px] text-purple-600 font-semibold mt-1 flex items-center gap-1">
              <LogIn size={10} /> Aguardando check-in
            </p>
          ) : isOverdue ? (
            <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
              <AlertTriangle size={10} /> {Math.abs(days)}d atrasado
            </p>
          ) : isCheckoutToday ? (
            <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1">
              <LogOut size={10} /> Saída HOJE
            </p>
          ) : (
            <p className="text-[10px] text-blue-600 font-medium mt-1">
              {days} dia{days !== 1 ? 's' : ''} restante{days !== 1 ? 's' : ''}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-green-600 font-medium">Livre</p>
      )}
    </button>
  )
}

// ── BedCard (modo cama individual) ───────────────────────────────────────────

function BedCard({ bed, alloc, today, onClick }: {
  bed: BedData; alloc: AllocData | undefined; today: string; onClick: () => void
}) {
  const isMaintenance = bed.status === 'manutencao'
  const isOccupied = !!alloc
  const days = alloc ? daysRemaining(alloc.checkOut, today) : 0
  const isCheckoutToday = alloc && alloc.checkOut === today
  const isOverdue = alloc && days < 0
  const needsCheckin = alloc && alloc.allocStatus === 'confirmada'

  let borderColor = 'border-green-300'
  let bgColor = 'bg-green-50/60'
  let dotColor = 'bg-green-400'

  if (isMaintenance) { borderColor = 'border-yellow-300'; bgColor = 'bg-yellow-50/60'; dotColor = 'bg-yellow-400' }
  else if (isOverdue) { borderColor = 'border-red-400'; bgColor = 'bg-red-50'; dotColor = 'bg-red-500' }
  else if (isCheckoutToday) { borderColor = 'border-red-300'; bgColor = 'bg-red-50/60'; dotColor = 'bg-red-400' }
  else if (needsCheckin) { borderColor = 'border-purple-300'; bgColor = 'bg-purple-50/60'; dotColor = 'bg-purple-400' }
  else if (isOccupied) { borderColor = 'border-blue-300'; bgColor = 'bg-blue-50/60'; dotColor = 'bg-blue-400' }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left w-full p-3 rounded-lg border-2 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${borderColor} ${bgColor}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor} ${isCheckoutToday || isOverdue ? 'animate-pulse' : ''}`} />
        <span className="text-xs font-semibold text-gray-800 truncate">{bed.label}</span>
      </div>

      {isMaintenance ? (
        <p className="text-[10px] text-yellow-600 flex items-center gap-1"><Wrench size={10} /> Manutenção</p>
      ) : isOccupied ? (
        <>
          <p className="text-sm font-medium text-gray-900 truncate">{alloc.guestName}</p>
          <p className="text-[10px] text-gray-400">{GUEST_TYPE_LABEL[alloc.guestType] ?? alloc.guestType}</p>
          {needsCheckin ? (
            <p className="text-[10px] text-purple-600 font-semibold mt-1"><LogIn size={10} className="inline" /> Aguardando check-in</p>
          ) : isOverdue ? (
            <p className="text-[10px] text-red-600 font-bold mt-1"><AlertTriangle size={10} className="inline" /> {Math.abs(days)}d atrasado</p>
          ) : isCheckoutToday ? (
            <p className="text-[10px] text-red-600 font-semibold mt-1"><LogOut size={10} className="inline" /> Saída HOJE</p>
          ) : (
            <p className="text-[10px] text-blue-600 font-medium mt-1">{days} dia{days !== 1 ? 's' : ''}</p>
          )}
        </>
      ) : (
        <p className="text-[10px] text-green-600 font-medium mt-1">Livre</p>
      )}
    </button>
  )
}

// ── MaintenanceButton ────────────────────────────────────────────────────────

function MaintenanceToggle({ action, id, fieldName, isInMaintenance }: {
  action: (fd: FormData) => Promise<void>; id: string; fieldName: string; isInMaintenance: boolean
}) {
  return (
    <form action={action}>
      <input type="hidden" name={fieldName} value={id} />
      <input type="hidden" name="enable" value={isInMaintenance ? 'false' : 'true'} />
      <button
        type="submit"
        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
          isInMaintenance
            ? 'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100'
            : 'bg-yellow-50 border border-yellow-200 text-yellow-700 hover:bg-yellow-100'
        }`}
      >
        <Wrench size={16} />
        {isInMaintenance ? 'Tirar de Manutenção' : 'Colocar em Manutenção'}
      </button>
    </form>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function BedGrid({
  rooms, beds, allocs, schools, today, advanceHours, slug,
  allocateAction, allocateRoomAction,
  checkinAction, checkoutAction,
  checkinRoomAction, checkoutRoomAction,
  toggleRoomMaintenanceAction, toggleBedMaintenanceAction,
}: Props) {
  const [selectedBed, setSelectedBed] = useState<BedData | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null)

  const now = new Date()
  const cutoff = new Date(now.getTime() + advanceHours * 3_600_000)
  const cutoffDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`

  const visibleAllocs = allocs.filter(a => a.checkIn <= cutoffDate)

  const allocByBed = new Map<string, AllocData>()
  const allocsByRoom = new Map<string, AllocData[]>()
  for (const a of visibleAllocs) {
    if (a.bedId) allocByBed.set(a.bedId, a)
    const list = allocsByRoom.get(a.roomId) ?? []
    list.push(a)
    allocsByRoom.set(a.roomId, list)
  }

  const bedsByRoom = new Map<string, BedData[]>()
  for (const b of beds) {
    const list = bedsByRoom.get(b.roomId) ?? []
    list.push(b)
    bedsByRoom.set(b.roomId, list)
  }

  // Group rooms by block
  const blocks = new Map<string, RoomData[]>()
  for (const room of rooms) {
    const key = room.block || 'Sem bloco'
    const list = blocks.get(key) ?? []
    list.push(room)
    blocks.set(key, list)
  }
  const blockNames = [...blocks.keys()].sort((a, b) => {
    if (a === 'Sem bloco') return 1
    if (b === 'Sem bloco') return -1
    return a.localeCompare(b)
  })

  // Alerts
  const overdueAllocs = allocs.filter(a => daysRemaining(a.checkOut, today) < 0)
  const checkoutTodayAllocs = allocs.filter(a => a.checkOut === today)
  const pendingCheckins = allocs.filter(a => a.allocStatus === 'confirmada')

  const selectedBedAlloc = selectedBed ? allocByBed.get(selectedBed.id) : undefined
  const selectedRoomAllocs = selectedRoom ? (allocsByRoom.get(selectedRoom.id) ?? []) : []
  const selectedRoomBeds = selectedRoom ? (bedsByRoom.get(selectedRoom.id) ?? []) : []
  const selectedRoomFirstAlloc = selectedRoomAllocs[0]
  const selectedRoomIsOccupied = selectedRoomAllocs.length > 0

  return (
    <>
      {/* Alerts */}
      {(overdueAllocs.length > 0 || checkoutTodayAllocs.length > 0 || pendingCheckins.length > 0) && (
        <div className="space-y-2">
          {overdueAllocs.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              <AlertTriangle size={16} /> {overdueAllocs.length} hóspede(s) com estadia vencida
            </div>
          )}
          {checkoutTodayAllocs.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-sm font-medium">
              <LogOut size={16} /> {checkoutTodayAllocs.length} check-out(s) pendente(s) hoje
            </div>
          )}
          {pendingCheckins.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium">
              <LogIn size={16} /> {pendingCheckins.length} check-in(s) aguardando
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] font-medium text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400" /> Livre</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Ocupada</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Aguarda check-in</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" /> Saída hoje / atrasado</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> Manutenção</span>
      </div>

      {/* Blocks with rooms/beds */}
      {blockNames.map(blockName => {
        const blockRooms = blocks.get(blockName)!
        return (
          <div key={blockName} className="space-y-3">
            {blockNames.length > 1 && (
              <div className="flex items-center gap-2 pt-2">
                <Building2 size={14} className="text-gray-400" />
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide">{blockName}</h3>
                <div className="flex-1 border-t border-gray-200" />
              </div>
            )}

            {blockRooms.map(room => {
              const roomBeds = bedsByRoom.get(room.id) ?? []
              const roomAllocs = allocsByRoom.get(room.id) ?? []

              if (room.allocationMode === 'quarto') {
                return (
                  <div key={room.id}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      <RoomCard
                        room={room}
                        roomBeds={roomBeds}
                        roomAllocs={roomAllocs}
                        today={today}
                        onClick={() => setSelectedRoom(room)}
                      />
                    </div>
                  </div>
                )
              }

              if (roomBeds.length === 0) return null

              return (
                <div key={room.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">{room.name}</h4>
                    {room.floor && <span className="text-[10px] text-gray-400">{room.floor}</span>}
                    {room.gender && <span className={`text-[10px] font-medium ${GENDER_CLS[room.gender]}`}>{GENDER_LABEL[room.gender]}</span>}
                    <span className={`text-[10px] font-medium ${DEST_CLS[room.destination]}`}>{DEST_LABEL[room.destination]}</span>
                    {room.status === 'manutencao' && <span className="text-[10px] font-medium text-yellow-600">Manutenção</span>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {roomBeds.map(bed => (
                      <BedCard
                        key={bed.id}
                        bed={bed}
                        alloc={allocByBed.get(bed.id)}
                        today={today}
                        onClick={() => setSelectedBed(bed)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* ── Modal: Cama individual ──────────────────────────────────────────── */}
      {selectedBed && (
        <Modal
          open
          onClose={() => setSelectedBed(null)}
          title={`${selectedBed.label} — ${selectedBed.roomName}`}
          subtitle={[selectedBed.roomFloor, selectedBed.roomGender ? GENDER_LABEL[selectedBed.roomGender] : null].filter(Boolean).join(' · ') || undefined}
          hideFooter
        >
          <div className="p-5 space-y-4">
            {selectedBed.status === 'manutencao' ? (
              <>
                <div className="text-center text-sm text-yellow-600 py-4">
                  <Wrench size={24} className="mx-auto mb-2" />
                  Esta cama está em manutenção.
                </div>
                <MaintenanceToggle action={toggleBedMaintenanceAction} id={selectedBed.id} fieldName="bed_id" isInMaintenance />
              </>
            ) : selectedBedAlloc ? (
              <>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-gray-900">{selectedBedAlloc.guestName}</p>
                  <p className="text-sm text-gray-500">{GUEST_TYPE_LABEL[selectedBedAlloc.guestType]}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 font-medium mb-0.5">Check-in</p>
                    <p className="font-semibold text-gray-900">{fmtDate(selectedBedAlloc.checkIn)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 font-medium mb-0.5">Check-out</p>
                    <p className="font-semibold text-gray-900">{fmtDate(selectedBedAlloc.checkOut)}</p>
                  </div>
                </div>
                {(() => {
                  const d = daysRemaining(selectedBedAlloc.checkOut, today)
                  if (d < 0) return <p className="text-sm font-bold text-red-600 text-center">{Math.abs(d)} dia(s) atrasado!</p>
                  if (d === 0) return <p className="text-sm font-bold text-red-600 text-center">Saída HOJE</p>
                  return <p className="text-sm text-blue-600 text-center font-medium">{d} dia(s) restante(s)</p>
                })()}
                {selectedBedAlloc.allocStatus === 'confirmada' && (
                  <form action={checkinAction} onSubmit={() => setSelectedBed(null)}>
                    <input type="hidden" name="id" value={selectedBedAlloc.id} />
                    <input type="hidden" name="bed_id" value={selectedBed.id} />
                    <button type="submit" className="w-full py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                      <LogIn size={18} /> Fazer Check-in
                    </button>
                  </form>
                )}
                {selectedBedAlloc.allocStatus === 'checkin' && (
                  <form action={checkoutAction} onSubmit={() => setSelectedBed(null)}>
                    <input type="hidden" name="id" value={selectedBedAlloc.id} />
                    <input type="hidden" name="bed_id" value={selectedBed.id} />
                    <button type="submit" className="w-full py-3 rounded-lg bg-gray-700 hover:bg-gray-800 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                      <LogOut size={18} /> Fazer Check-out
                    </button>
                  </form>
                )}
              </>
            ) : (
              <form action={allocateAction} onSubmit={() => setSelectedBed(null)} className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <UserPlus size={20} />
                  <p className="text-sm font-semibold">Alocar hóspede</p>
                </div>
                <input type="hidden" name="room_id" value={selectedBed.roomId} />
                <input type="hidden" name="bed_id" value={selectedBed.id} />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                  <input name="guest_name" required placeholder="Nome completo" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
                    <select name="guest_type" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                      {GUEST_TYPES.filter(t => {
                        const room = rooms.find(r => r.id === selectedBed.roomId)
                        if (room?.destination === 'obreiro') return t.value === 'obreiro'
                        return true
                      }).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Check-in *</label>
                    <input name="check_in" type="date" required defaultValue={today} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Check-out *</label>
                  <input name="check_out" type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <button type="submit" className="w-full py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                  <BedDouble size={18} /> Alocar
                </button>
              </form>
            )}

            {/* Maintenance toggle for non-maintenance beds */}
            {selectedBed.status !== 'manutencao' && !selectedBedAlloc && (
              <MaintenanceToggle action={toggleBedMaintenanceAction} id={selectedBed.id} fieldName="bed_id" isInMaintenance={false} />
            )}
          </div>
        </Modal>
      )}

      {/* ── Modal: Quarto inteiro ───────────────────────────────────────────── */}
      {selectedRoom && (
        <Modal
          open
          onClose={() => setSelectedRoom(null)}
          title={selectedRoom.name}
          subtitle={[selectedRoom.floor, selectedRoom.gender ? GENDER_LABEL[selectedRoom.gender] : null, DEST_LABEL[selectedRoom.destination]].filter(Boolean).join(' · ') || undefined}
          hideFooter
        >
          <div className="p-5 space-y-4">
            <p className="text-xs text-gray-400">
              {selectedRoomBeds.length} cama{selectedRoomBeds.length !== 1 ? 's' : ''} · Modo quarto inteiro
            </p>

            {selectedRoom.status === 'manutencao' ? (
              <>
                <div className="text-center text-sm text-yellow-600 py-4">
                  <Wrench size={24} className="mx-auto mb-2" />
                  Este quarto está em manutenção.
                </div>
                <MaintenanceToggle action={toggleRoomMaintenanceAction} id={selectedRoom.id} fieldName="room_id" isInMaintenance />
              </>
            ) : selectedRoomIsOccupied && selectedRoomFirstAlloc ? (
              <>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedRoomFirstAlloc.schoolName ?? selectedRoomFirstAlloc.guestName}
                  </p>
                  <p className="text-sm text-gray-500">{GUEST_TYPE_LABEL[selectedRoomFirstAlloc.guestType]}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 font-medium mb-0.5">Check-in</p>
                    <p className="font-semibold text-gray-900">{fmtDate(selectedRoomFirstAlloc.checkIn)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 font-medium mb-0.5">Check-out</p>
                    <p className="font-semibold text-gray-900">{fmtDate(selectedRoomFirstAlloc.checkOut)}</p>
                  </div>
                </div>
                {(() => {
                  const d = daysRemaining(selectedRoomFirstAlloc.checkOut, today)
                  if (d < 0) return <p className="text-sm font-bold text-red-600 text-center">{Math.abs(d)} dia(s) atrasado!</p>
                  if (d === 0) return <p className="text-sm font-bold text-red-600 text-center">Saída HOJE</p>
                  return <p className="text-sm text-blue-600 text-center font-medium">{d} dia(s) restante(s)</p>
                })()}
                {selectedRoomFirstAlloc.allocStatus === 'confirmada' && (
                  <form action={checkinRoomAction} onSubmit={() => setSelectedRoom(null)}>
                    <input type="hidden" name="room_id" value={selectedRoom.id} />
                    <button type="submit" className="w-full py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                      <LogIn size={18} /> Check-in do Quarto
                    </button>
                  </form>
                )}
                {selectedRoomFirstAlloc.allocStatus === 'checkin' && (
                  <form action={checkoutRoomAction} onSubmit={() => setSelectedRoom(null)}>
                    <input type="hidden" name="room_id" value={selectedRoom.id} />
                    <button type="submit" className="w-full py-3 rounded-lg bg-gray-700 hover:bg-gray-800 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                      <LogOut size={18} /> Check-out do Quarto
                    </button>
                  </form>
                )}
              </>
            ) : (
              <form action={allocateRoomAction} onSubmit={() => setSelectedRoom(null)} className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <UserPlus size={20} />
                  <p className="text-sm font-semibold">
                    {selectedRoom.destination === 'aluno' ? 'Alocar escola neste quarto' : 'Alocar visitante neste quarto'}
                  </p>
                </div>
                <input type="hidden" name="room_id" value={selectedRoom.id} />

                {selectedRoom.destination === 'aluno' && schools.length > 0 ? (
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
                    <input name="check_in" type="date" required defaultValue={today} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Check-out *</label>
                    <input name="check_out" type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                </div>
                <button type="submit" className="w-full py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                  <BedDouble size={18} /> Alocar Quarto Inteiro
                </button>
              </form>
            )}

            {/* Maintenance toggle */}
            {selectedRoom.status !== 'manutencao' && !selectedRoomIsOccupied && (
              <MaintenanceToggle action={toggleRoomMaintenanceAction} id={selectedRoom.id} fieldName="room_id" isInMaintenance={false} />
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
