'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { AlertTriangle, BedDouble, LogIn, LogOut, UserPlus, Wrench } from 'lucide-react'

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
}

type RoomData = {
  id: string
  name: string
  floor: string | null
  gender: string | null
  status: string
}

type Props = {
  rooms: RoomData[]
  beds: BedData[]
  allocs: AllocData[]
  today: string
  slug: string
  allocateAction: (fd: FormData) => Promise<void>
  checkinAction: (fd: FormData) => Promise<void>
  checkoutAction: (fd: FormData) => Promise<void>
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

const GENDER_LABEL: Record<string, string> = {
  masculino: 'Masc.', feminino: 'Fem.', misto: 'Misto',
}

const GENDER_CLS: Record<string, string> = {
  masculino: 'text-blue-500', feminino: 'text-pink-500', misto: 'text-purple-500',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysRemaining(checkOut: string, today: string): number {
  const out = new Date(checkOut + 'T00:00:00')
  const now = new Date(today + 'T00:00:00')
  return Math.ceil((out.getTime() - now.getTime()) / 86_400_000)
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

// ── BedCard ──────────────────────────────────────────────────────────────────

function BedCard({ bed, alloc, today, onClick }: {
  bed: BedData
  alloc: AllocData | undefined
  today: string
  onClick: () => void
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

  if (isMaintenance) {
    borderColor = 'border-yellow-300'; bgColor = 'bg-yellow-50/60'; dotColor = 'bg-yellow-400'
  } else if (isOverdue) {
    borderColor = 'border-red-400'; bgColor = 'bg-red-50'; dotColor = 'bg-red-500'
  } else if (isCheckoutToday) {
    borderColor = 'border-red-300'; bgColor = 'bg-red-50/60'; dotColor = 'bg-red-400'
  } else if (needsCheckin) {
    borderColor = 'border-purple-300'; bgColor = 'bg-purple-50/60'; dotColor = 'bg-purple-400'
  } else if (isOccupied) {
    borderColor = 'border-blue-300'; bgColor = 'bg-blue-50/60'; dotColor = 'bg-blue-400'
  }

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
        <p className="text-[10px] text-green-600 font-medium mt-1">Livre</p>
      )}
    </button>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function BedGrid({ rooms, beds, allocs, today, slug, allocateAction, checkinAction, checkoutAction }: Props) {
  const [selectedBed, setSelectedBed] = useState<BedData | null>(null)

  const allocByBed = new Map<string, AllocData>()
  for (const a of allocs) {
    if (a.bedId) allocByBed.set(a.bedId, a)
  }

  const selectedAlloc = selectedBed ? allocByBed.get(selectedBed.id) : undefined

  const alerts = allocs.filter(a => {
    const days = daysRemaining(a.checkOut, today)
    return days <= 0 || a.allocStatus === 'confirmada'
  })

  return (
    <>
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.filter(a => daysRemaining(a.checkOut, today) < 0).length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              <AlertTriangle size={16} />
              {alerts.filter(a => daysRemaining(a.checkOut, today) < 0).length} hóspede(s) com estadia vencida
            </div>
          )}
          {alerts.filter(a => a.checkOut === today).length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 text-sm font-medium">
              <LogOut size={16} />
              {alerts.filter(a => a.checkOut === today).length} check-out(s) pendente(s) hoje
            </div>
          )}
          {alerts.filter(a => a.allocStatus === 'confirmada').length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium">
              <LogIn size={16} />
              {alerts.filter(a => a.allocStatus === 'confirmada').length} check-in(s) aguardando
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

      {/* Room sections with bed grids */}
      {rooms.map(room => {
        const roomBeds = beds.filter(b => b.roomId === room.id)
        if (roomBeds.length === 0) return null

        return (
          <div key={room.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">{room.name}</h3>
              {room.floor && <span className="text-[10px] text-gray-400">{room.floor}</span>}
              {room.gender && (
                <span className={`text-[10px] font-medium ${GENDER_CLS[room.gender] ?? 'text-gray-400'}`}>
                  {GENDER_LABEL[room.gender] ?? room.gender}
                </span>
              )}
              {room.status === 'manutencao' && (
                <span className="text-[10px] font-medium text-yellow-600">Manutenção</span>
              )}
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

      {/* Click modal */}
      {selectedBed && (
        <Modal
          open
          onClose={() => setSelectedBed(null)}
          title={`${selectedBed.label} — ${selectedBed.roomName}`}
          subtitle={[selectedBed.roomFloor, selectedBed.roomGender ? GENDER_LABEL[selectedBed.roomGender] : null].filter(Boolean).join(' · ') || undefined}
          hideFooter
        >
          {selectedBed.status === 'manutencao' ? (
            <div className="p-5 text-center text-sm text-yellow-600">
              <Wrench size={24} className="mx-auto mb-2" />
              Esta cama está em manutenção.
            </div>
          ) : selectedAlloc ? (
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-lg font-semibold text-gray-900">{selectedAlloc.guestName}</p>
                <p className="text-sm text-gray-500">{GUEST_TYPE_LABEL[selectedAlloc.guestType] ?? selectedAlloc.guestType}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 font-medium mb-0.5">Check-in</p>
                  <p className="font-semibold text-gray-900">{fmtDate(selectedAlloc.checkIn)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 font-medium mb-0.5">Check-out</p>
                  <p className="font-semibold text-gray-900">{fmtDate(selectedAlloc.checkOut)}</p>
                </div>
              </div>
              {(() => {
                const days = daysRemaining(selectedAlloc.checkOut, today)
                if (days < 0) return <p className="text-sm font-bold text-red-600 text-center">{Math.abs(days)} dia(s) atrasado!</p>
                if (days === 0) return <p className="text-sm font-bold text-red-600 text-center">Saída HOJE</p>
                return <p className="text-sm text-blue-600 text-center font-medium">{days} dia(s) restante(s)</p>
              })()}

              {selectedAlloc.allocStatus === 'confirmada' && (
                <form action={checkinAction} onSubmit={() => setSelectedBed(null)}>
                  <input type="hidden" name="id" value={selectedAlloc.id} />
                  <input type="hidden" name="bed_id" value={selectedBed.id} />
                  <button type="submit" className="w-full py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                    <LogIn size={18} /> Fazer Check-in
                  </button>
                </form>
              )}
              {selectedAlloc.allocStatus === 'checkin' && (
                <form action={checkoutAction} onSubmit={() => setSelectedBed(null)}>
                  <input type="hidden" name="id" value={selectedAlloc.id} />
                  <input type="hidden" name="bed_id" value={selectedBed.id} />
                  <button type="submit" className="w-full py-3 rounded-lg bg-gray-700 hover:bg-gray-800 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                    <LogOut size={18} /> Fazer Check-out
                  </button>
                </form>
              )}
            </div>
          ) : (
            <form action={allocateAction} className="p-5 space-y-4" onSubmit={() => setSelectedBed(null)}>
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <UserPlus size={20} />
                <p className="text-sm font-semibold">Alocar hóspede nesta cama</p>
              </div>
              <input type="hidden" name="room_id" value={selectedBed.roomId} />
              <input type="hidden" name="bed_id" value={selectedBed.id} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome do hóspede *</label>
                <input name="guest_name" required placeholder="Nome completo"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
                  <select name="guest_type" required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {GUEST_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Check-in *</label>
                  <input name="check_in" type="date" required defaultValue={today}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Check-out *</label>
                <input name="check_out" type="date" required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                <input name="notes" placeholder="Opcional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <button type="submit"
                className="w-full py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                <BedDouble size={18} /> Alocar
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  )
}
