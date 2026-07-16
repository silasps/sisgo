'use client'

import { useState, useTransition } from 'react'
import { getAvailableRooms, type AvailableRoom } from '../hospedagem/actions'
import { INDEFINITE_CHECKOUT, isIndefiniteCheckout } from '@/lib/hospedagem'

type ServiceReq = {
  id: string
  subject: string
  request_type: string
  target_department: string
  description: string | null
  status: string
  created_at: string
  requester_role: string
  requester_id: string
  requested_arrival_date: string | null
  requested_departure_date: string | null
  staff_application_id: string | null
  school_application_id: string | null
  // embedded
  requesterName: string
  requesterEmail: string
  requesterPhone: string | null
  diasAberto: number
}

const HOSPEDAGEM_TYPES = ['hospedagem_obreiro', 'hospedagem_aluno']

const SERVICE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente:   { label: 'Pendente',   color: 'bg-yellow-100 text-yellow-700' },
  em_analise: { label: 'Em análise', color: 'bg-blue-100 text-blue-700' },
  resolvido:  { label: 'Resolvido',  color: 'bg-green-100 text-green-700' },
  rejeitado:  { label: 'Rejeitado',  color: 'bg-red-100 text-red-700' },
}

function urgencyColor(dias: number) {
  if (dias <= 1) return 'bg-green-100 text-green-700'
  if (dias === 2) return 'bg-yellow-100 text-yellow-700'
  if (dias === 3) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}
function urgencyLabel(dias: number) {
  if (dias === 0) return 'Hoje'
  return `${dias}d`
}

function whatsappDigits(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.length >= 12 && digits.length <= 15) return digits
  return null
}

type ResolverComAlocacaoParams = {
  requestId: string; roomId: string; bedId: string | null; personId: string | null
  guestName: string; guestType: 'obreiro' | 'aluno'; checkIn: string; checkOut: string
}
type ResolverSemAlocacaoParams = {
  requestId: string; guestName: string; staffApplicationId: string | null; schoolApplicationId: string | null; requestedArrivalDate: string | null
}

type Props = {
  requests: ServiceReq[]
  title: string
  handleStatusUpdate: (fd: FormData) => Promise<void>
  resolverComAlocacao?: (params: ResolverComAlocacaoParams) => Promise<void>
  resolverSemAlocacao?: (params: ResolverSemAlocacaoParams) => Promise<void>
  organizationId?: string
}

function HospedagemResolver({ req, organizationId, resolverComAlocacao, resolverSemAlocacao, onDone }: {
  req: ServiceReq
  organizationId: string
  resolverComAlocacao: (params: ResolverComAlocacaoParams) => Promise<void>
  resolverSemAlocacao: (params: ResolverSemAlocacaoParams) => Promise<void>
  onDone: () => void
}) {
  const guestType: 'obreiro' | 'aluno' = req.request_type === 'hospedagem_aluno' ? 'aluno' : 'obreiro'
  const guestName = req.subject.replace(/^Hospedagem\s*—\s*/, '')
  const departureAlreadyIndefinite = isIndefiniteCheckout(req.requested_departure_date)
  const [checkOut, setCheckOut] = useState(departureAlreadyIndefinite ? '' : req.requested_departure_date ?? '')
  const [indefinite, setIndefinite] = useState(departureAlreadyIndefinite)
  const [rooms, setRooms] = useState<AvailableRoom[] | null>(null)
  const [chosenRoom, setChosenRoom] = useState<AvailableRoom | null>(null)
  const [chosenBed, setChosenBed] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const checkIn = req.requested_arrival_date ?? ''
  const effectiveCheckOut = indefinite ? INDEFINITE_CHECKOUT : checkOut

  function buscar() {
    setError('')
    if (!effectiveCheckOut) { setError('Informe a saída prevista, ou marque "sem data de saída definida".'); return }
    startTransition(async () => {
      const available = await getAvailableRooms({ organizationId, guestType, checkIn, checkOut: effectiveCheckOut })
      setRooms(available)
    })
  }

  function confirmarComQuarto() {
    if (!chosenRoom) return
    if (chosenRoom.allocationMode === 'cama' && !chosenBed) { setError('Selecione uma cama.'); return }
    startTransition(async () => {
      await resolverComAlocacao({
        requestId: req.id, roomId: chosenRoom.roomId, bedId: chosenRoom.allocationMode === 'cama' ? chosenBed : null,
        personId: null, guestName, guestType, checkIn, checkOut: effectiveCheckOut,
      })
      onDone()
    })
  }

  function confirmarSemQuarto() {
    startTransition(async () => {
      await resolverSemAlocacao({
        requestId: req.id, guestName,
        staffApplicationId: req.staff_application_id, schoolApplicationId: req.school_application_id,
        requestedArrivalDate: req.requested_arrival_date,
      })
      onDone()
    })
  }

  return (
    <div className="space-y-3 border-t border-gray-100 pt-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resolver hospedagem</p>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Chegada</label>
          <input type="date" value={checkIn} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-500" />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Saída prevista</label>
          <input type="date" value={checkOut} disabled={indefinite}
            onChange={e => { setCheckOut(e.target.value); setRooms(null) }}
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 disabled:bg-gray-50 disabled:text-gray-400" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={indefinite}
          onChange={e => { setIndefinite(e.target.checked); if (e.target.checked) setCheckOut(''); setRooms(null) }} />
        Sem data de saída definida {guestType === 'obreiro' ? '(obreiro permanente)' : '(ajustar depois)'}
      </label>
      <button type="button" onClick={buscar} disabled={pending || !effectiveCheckOut}
        className="w-full px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50">
        {pending ? 'Buscando…' : 'Buscar quartos disponíveis'}
      </button>

      {rooms && (
        rooms.length === 0 ? (
          <p className="text-xs text-red-600">Nenhum quarto disponível nessa janela de datas.</p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500">Escolha um quarto{rooms.some(r => r.allocationMode === 'cama') ? ' (e cama, se for o caso)' : ''} pra habilitar "Confirmar e alocar agora":</p>
            {rooms.map(r => (
              <label key={r.roomId} className={`block rounded-lg border px-3 py-2 text-xs cursor-pointer ${chosenRoom?.roomId === r.roomId ? 'border-brand-400 bg-brand-50' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <input type="radio" name="room" checked={chosenRoom?.roomId === r.roomId}
                    onChange={() => { setChosenRoom(r); setChosenBed('') }} />
                  <span className="font-semibold text-gray-800">{r.roomName}</span>
                  {r.genderConstraint && <span className="text-gray-400">({r.genderConstraint})</span>}
                </div>
                {chosenRoom?.roomId === r.roomId && r.allocationMode === 'cama' && (
                  <select value={chosenBed} onChange={e => setChosenBed(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                    onClick={e => e.stopPropagation()}>
                    <option value="">Selecione a cama…</option>
                    {r.availableBeds.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                )}
              </label>
            ))}
          </div>
        )
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {rooms && rooms.length > 0 && (
        <button type="button" onClick={confirmarComQuarto} disabled={pending || !chosenRoom}
          className="w-full px-4 py-2.5 bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
          ✓ Confirmar e alocar agora
        </button>
      )}
      <button type="button" onClick={confirmarSemQuarto} disabled={pending}
        className="w-full px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
        Confirmar disponibilidade, definir quarto depois
      </button>
      <p className="text-xs text-gray-400">
        "Definir depois" já libera a candidatura (não fica mais pendente do líder/DH) — a escolha do quarto vira uma tarefa só da hospitalidade.
      </p>
    </div>
  )
}

export function ServiceRequestsPanel({ requests, title, handleStatusUpdate, resolverComAlocacao, resolverSemAlocacao, organizationId }: Props) {
  const [selected, setSelected] = useState<ServiceReq | null>(null)

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">
            {title}
            <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
              {requests.length}
            </span>
          </h3>
        </div>
        <div className="p-3 space-y-2">
          {requests.map(sr => {
            const statusInfo = SERVICE_STATUS_LABELS[sr.status] ?? { label: sr.status, color: 'bg-gray-100 text-gray-500' }
            const dias = sr.diasAberto
            return (
              <button
                key={sr.id}
                type="button"
                onClick={() => setSelected(sr)}
                className="group w-full text-left flex items-center gap-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
              >
                <span className={`flex-shrink-0 inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold ${urgencyColor(dias)}`}>
                  {urgencyLabel(dias)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 truncate transition-colors">
                    {sr.subject}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {sr.requesterName} · {sr.target_department}
                  </p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <span className="text-xs font-semibold text-brand-500 group-hover:text-brand-700 transition-colors">
                    Abrir →
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 md:left-60 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide">
                  {selected.target_department} · {selected.request_type}
                </p>
                <h2 className="text-base font-bold text-gray-900 mt-0.5">{selected.subject}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none flex-shrink-0 mt-0.5"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Status + urgência */}
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const s = SERVICE_STATUS_LABELS[selected.status] ?? { label: selected.status, color: 'bg-gray-100 text-gray-500' }
                  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.color}`}>{s.label}</span>
                })()}
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${urgencyColor(selected.diasAberto)}`}>
                  {selected.diasAberto === 0 ? 'Hoje' : `${selected.diasAberto}d atrás`}
                </span>
              </div>

              {/* Data de chegada (solicitações de hospedagem) */}
              {selected.requested_arrival_date && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Chegada prevista</p>
                  <p className="text-sm text-gray-900 font-semibold">
                    {new Date(selected.requested_arrival_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}

              {/* Descrição */}
              {selected.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Descrição</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selected.description}</p>
                </div>
              )}

              {/* Solicitante */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Solicitante</p>
                <p className="text-sm font-semibold text-gray-900">{selected.requesterName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{selected.requesterEmail}</p>
                <p className="text-xs text-gray-500">{selected.requester_role}</p>
                {selected.requesterPhone && (() => {
                  const digits = whatsappDigits(selected.requesterPhone)
                  return digits ? (
                    <a
                      href={`https://wa.me/${digits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
                    >
                      WhatsApp
                    </a>
                  ) : null
                })()}
              </div>

              {/* Ações */}
              <div className="border-t border-gray-100 pt-4 flex flex-col gap-2">
                {selected.status === 'pendente' && (
                  <form action={handleStatusUpdate} onSubmit={() => setSelected(null)}>
                    <input type="hidden" name="request_id" value={selected.id} />
                    <button
                      name="status" value="em_analise" type="submit"
                      className="w-full px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-sm font-semibold transition-colors"
                    >
                      Marcar como Em análise
                    </button>
                  </form>
                )}
                {selected.status !== 'resolvido' && HOSPEDAGEM_TYPES.includes(selected.request_type) && resolverComAlocacao && resolverSemAlocacao && organizationId ? (
                  <HospedagemResolver
                    req={selected}
                    organizationId={organizationId}
                    resolverComAlocacao={resolverComAlocacao}
                    resolverSemAlocacao={resolverSemAlocacao}
                    onDone={() => setSelected(null)}
                  />
                ) : selected.status !== 'resolvido' && (
                  <form action={handleStatusUpdate} onSubmit={() => setSelected(null)}>
                    <input type="hidden" name="request_id" value={selected.id} />
                    <button
                      name="status" value="resolvido" type="submit"
                      className="w-full px-4 py-2.5 bg-green-500 text-white hover:bg-green-600 rounded-xl text-sm font-semibold transition-colors"
                    >
                      ✓ Marcar como Resolvido
                    </button>
                  </form>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="w-full px-4 py-2.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
