'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePendingAction } from '@/hooks/usePendingAction'
import { getAvailableRooms, getHospedagemKpis, type AvailableRoom, type HospedagemKpis } from '../hospedagem/actions'
import { INDEFINITE_CHECKOUT, isIndefiniteCheckout, HOSPEDAGEM_TYPES, guestTypeForServiceRequest, type FamilyInfo } from '@/lib/hospedagem'
import { useSidebarLeftClass } from '@/components/layout/account-context'
import { SubmitButton } from '@/components/ui/SubmitButton'

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
  familyInfo: FamilyInfo | null
  guestGender: 'masculino' | 'feminino' | null
}

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

type ResolverComAlocacaoQuartoParams = {
  requestId: string; roomId: string
  guestName: string; guestType: 'obreiro' | 'aluno'; checkIn: string; checkOut: string
}

type Props = {
  requests: ServiceReq[]
  title: string
  handleStatusUpdate: (fd: FormData) => Promise<void>
  resolverComAlocacao?: (params: ResolverComAlocacaoParams) => Promise<void>
  resolverComAlocacaoQuarto?: (params: ResolverComAlocacaoQuartoParams) => Promise<void>
  markEmAnalise?: (requestId: string) => Promise<void>
  organizationId?: string
  slug?: string
}

function HospedagemResolver({ req, organizationId, resolverComAlocacao, resolverComAlocacaoQuarto, markEmAnalise, handleStatusUpdate, onDone, slug }: {
  req: ServiceReq
  organizationId: string
  resolverComAlocacao: (params: ResolverComAlocacaoParams) => Promise<void>
  resolverComAlocacaoQuarto?: (params: ResolverComAlocacaoQuartoParams) => Promise<void>
  markEmAnalise?: (requestId: string) => Promise<void>
  handleStatusUpdate: (fd: FormData) => Promise<void>
  onDone: () => void
  slug?: string
}) {
  const guestType = guestTypeForServiceRequest(req.request_type, req.school_application_id)
  const guestName = req.subject.replace(/^(Hospedagem|Definir quarto)\s*—\s*/, '')
  const departureAlreadyIndefinite = isIndefiniteCheckout(req.requested_departure_date)
  const [checkOut, setCheckOut] = useState(departureAlreadyIndefinite ? '' : req.requested_departure_date ?? '')
  const [showAllocation, setShowAllocation] = useState(false)
  const [showNoRoomForm, setShowNoRoomForm] = useState(false)
  const [noRoomReason, setNoRoomReason] = useState('')
  const { isPending: pending, run } = usePendingAction()

  // Cônjuge/filhos vindo junto (dado que já existe na candidatura) — quando
  // é família de verdade (mais de 1 pessoa), a tela de alocação só mostra
  // quarto inteiro do tamanho certo, não cama avulsa.
  const familySize = 1 + (req.familyInfo?.spouseComing ? 1 : 0) + (req.familyInfo?.childrenComing ?? 0)
  const isFamily = familySize > 1

  const checkIn = req.requested_arrival_date ?? ''
  // Sem data de saída = permanente — quem define isso é o DH/líder ao abrir
  // a solicitação (ou fica em aberto pra hospitalidade ajustar aqui mesmo);
  // não é uma escolha própria da hospitalidade, então não tem checkbox.
  const effectiveCheckOut = checkOut || INDEFINITE_CHECKOUT

  const actionLabel = isFamily ? 'Alocar família' : guestType === 'aluno' ? 'Alocar aluno' : 'Alocar obreiro'

  // A hospitalidade só diz se tem quarto ou não — se não tem, a decisão de
  // como resolver (esperar vaga, buscar fora, etc.) é do líder, não dela.
  // Exige justificativa: ela é o que aparece de volta no fluxo de aprovação
  // pro líder/DH entenderem o motivo, em vez de um "rejeitado" seco.
  function confirmarSemDisponibilidade() {
    if (!noRoomReason.trim()) return
    run(true, async () => {
      const fd = new FormData()
      fd.set('request_id', req.id)
      fd.set('status', 'rejeitado')
      fd.set('resolution_notes', noRoomReason.trim())
      await handleStatusUpdate(fd)
      onDone()
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resolver hospedagem</p>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Chegada</label>
          <input type="date" value={checkIn} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-500" />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Saída prevista</label>
          <input type="date" value={checkOut}
            onChange={e => setCheckOut(e.target.value)}
            placeholder="Em branco = permanente"
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700" />
        </div>
      </div>
      {!checkOut && (
        <p className="text-xs text-gray-400">
          Sem data de saída informada — entendido como {guestType === 'obreiro' ? 'obreiro permanente' : 'hospedagem sem data definida'}.
        </p>
      )}
      {isFamily && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">Vem com família — {familySize} pessoas ao todo</p>
          <p className="text-amber-700 mt-0.5">
            {[
              req.familyInfo?.spouseComing ? 'cônjuge' : null,
              (req.familyInfo?.childrenComing ?? 0) > 0 ? `${req.familyInfo?.childrenComing} filho(s)` : null,
            ].filter(Boolean).join(' + ')} vindo junto — a alocação vai priorizar quarto inteiro.
          </p>
        </div>
      )}
      {!showNoRoomForm ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowAllocation(true)} disabled={pending}
            className="flex-1 px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50">
            {actionLabel}
          </button>
          <button type="button" onClick={() => setShowNoRoomForm(true)} disabled={pending}
            className="flex-1 px-4 py-2 bg-red-50 text-red-700 text-xs font-semibold rounded-xl hover:bg-red-100 disabled:opacity-50">
            Não há disponibilidade
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <label className="block text-xs font-semibold text-red-800">
            Explique o motivo — o líder/DH vai ver essa justificativa
          </label>
          <textarea value={noRoomReason} onChange={e => setNoRoomReason(e.target.value)} rows={2} autoFocus
            placeholder="Ex.: sem cama disponível pro gênero na data pedida, só a partir de 10/10…"
            className="w-full rounded-lg border border-red-200 px-2 py-1.5 text-xs text-gray-700" />
          <div className="flex gap-2">
            <button type="button" onClick={confirmarSemDisponibilidade} disabled={pending || !noRoomReason.trim()}
              className="flex-1 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50">
              {pending ? 'Registrando…' : 'Confirmar sem disponibilidade'}
            </button>
            <button type="button" onClick={() => setShowNoRoomForm(false)} disabled={pending}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50">
              Cancelar
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-400">
        Sem vaga, a decisão de como resolver com a pessoa fica com o líder — a hospitalidade só confirma se há espaço.
      </p>

      {showAllocation && (
        <AllocationScreen
          req={req}
          organizationId={organizationId}
          guestType={guestType}
          guestName={guestName}
          checkIn={checkIn}
          checkOut={effectiveCheckOut}
          isFamily={isFamily}
          familySize={familySize}
          guestGender={req.guestGender}
          resolverComAlocacao={resolverComAlocacao}
          resolverComAlocacaoQuarto={resolverComAlocacaoQuarto}
          markEmAnalise={req.status === 'pendente' ? markEmAnalise : undefined}
          onClose={() => setShowAllocation(false)}
          onDone={onDone}
          slug={slug}
        />
      )}
    </div>
  )
}

// Tela cheia (portal, acima do modal de detalhe) — abre ao clicar em
// "Alocar X". Busca disponibilidade + KPIs da hospitalidade juntos, e já
// filtra a lista pelo caso concreto (família → só quarto inteiro do
// tamanho certo; indivíduo → só cama avulsa compatível com o gênero) em vez
// de despejar tudo pra hospitalidade filtrar na mão.
function AllocationScreen({
  req, organizationId, guestType, guestName, checkIn, checkOut, isFamily, familySize, guestGender,
  resolverComAlocacao, resolverComAlocacaoQuarto, markEmAnalise, onClose, onDone, slug,
}: {
  req: ServiceReq
  organizationId: string
  guestType: 'obreiro' | 'aluno'
  guestName: string
  checkIn: string
  checkOut: string
  isFamily: boolean
  familySize: number
  guestGender: 'masculino' | 'feminino' | null
  resolverComAlocacao: (params: ResolverComAlocacaoParams) => Promise<void>
  resolverComAlocacaoQuarto?: (params: ResolverComAlocacaoQuartoParams) => Promise<void>
  markEmAnalise?: (requestId: string) => Promise<void>
  onClose: () => void
  onDone: () => void
  slug?: string
}) {
  const sidebarLeftClass = useSidebarLeftClass()
  const router = useRouter()
  const [rooms, setRooms] = useState<AvailableRoom[] | null>(null)
  const [kpis, setKpis] = useState<HospedagemKpis | null>(null)
  const [chosenRoom, setChosenRoom] = useState<AvailableRoom | null>(null)
  const [chosenBed, setChosenBed] = useState('')
  const { isPending: pending, run } = usePendingAction()
  const [error, setError] = useState('')

  // Duas buscas independentes, não uma esperando a outra — cada seção da
  // tela (KPIs, lista de quartos) libera assim que a sua própria consulta
  // volta, em vez de travar tudo atrás da mais lenta das duas.
  useEffect(() => {
    let cancelled = false
    if (markEmAnalise) markEmAnalise(req.id).catch(() => {})
    getAvailableRooms({ organizationId, guestType, checkIn, checkOut }).then(available => {
      if (cancelled) return
      setRooms(available)
      router.refresh()
    })
    getHospedagemKpis(organizationId).then(kpisResult => {
      if (!cancelled) setKpis(kpisResult)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const genderOk = (r: AvailableRoom) =>
    !guestGender || !r.genderConstraint || r.genderConstraint === 'misto' || r.genderConstraint === guestGender

  const filteredRooms = (rooms ?? []).filter(r =>
    genderOk(r) && (isFamily ? (r.wholeRoomAvailable && r.totalBeds >= familySize) : r.availableBeds.length > 0))

  function confirmar() {
    if (!chosenRoom) return
    if (!isFamily && !chosenBed) { setError('Selecione uma cama.'); return }
    if (isFamily && !resolverComAlocacaoQuarto) { setError('Ação indisponível.'); return }
    run(true, async () => {
      if (isFamily) {
        await resolverComAlocacaoQuarto!({ requestId: req.id, roomId: chosenRoom.roomId, guestName, guestType, checkIn, checkOut })
      } else {
        await resolverComAlocacao({ requestId: req.id, roomId: chosenRoom.roomId, bedId: chosenBed, personId: null, guestName, guestType, checkIn, checkOut })
      }
      onDone()
    })
  }

  const kpiTiles = kpis ? [
    { label: 'Quartos', value: kpis.totalRooms },
    { label: 'Camas ocupadas', value: kpis.occupiedBeds },
    { label: 'Camas disponíveis', value: kpis.availableBeds },
    { label: 'Chegadas hoje', value: kpis.arrivalsToday },
    { label: 'Saídas hoje', value: kpis.departuresToday },
  ] : []

  return createPortal(
    <div className={`fixed inset-0 ${sidebarLeftClass} z-[60] flex items-center justify-center bg-black/50 p-4`} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide">Alocação</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">{guestName}</h2>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {slug && (
              <Link
                href={`/${slug}/hospedagem/quartos`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors whitespace-nowrap"
              >
                Gerenciar hospedagem →
              </Link>
            )}
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {isFamily && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              <p className="font-semibold">Família — {familySize} pessoas ao todo</p>
              <p className="text-amber-700 mt-0.5">Mostrando só quartos inteiros com espaço pra todo mundo.</p>
            </div>
          )}

          {kpis && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {kpiTiles.map(k => (
                <div key={k.label} className="bg-gray-50 rounded-lg border border-gray-200 px-2 py-2 text-center">
                  <p className="text-sm font-bold text-gray-900">{k.value}</p>
                  <p className="text-[9px] text-gray-500 font-medium leading-tight">{k.label}</p>
                </div>
              ))}
            </div>
          )}

          {rooms === null ? (
            <p className="text-xs text-gray-400 text-center py-6">Buscando disponibilidade…</p>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-4 space-y-3">
              <p className="text-xs text-red-600">
                Nenhum quarto {isFamily ? 'com espaço pra família toda' : guestGender ? `compatível (${guestGender})` : ''} disponível nessa janela de datas.
              </p>
              {slug && (
                <Link
                  href={`/${slug}/hospedagem/quartos`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Gerenciar hospedagem →
                </Link>
              )}
              <p className="text-[10px] text-gray-400">
                Lá dá pra ver tudo que está ocupado, mover gente de quarto ou cadastrar um quarto novo.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">Escolha onde alocar:</p>
              {filteredRooms.map(r => {
                const isChosen = chosenRoom?.roomId === r.roomId
                const location = [r.blockName, r.floorName, r.roomName].filter(Boolean).join(' — ')
                return (
                  <label key={r.roomId} className={`block rounded-lg border px-3 py-2 text-xs cursor-pointer ${isChosen ? 'border-brand-400 bg-brand-50' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="radio" name="alloc-room" checked={isChosen} onChange={() => { setChosenRoom(r); setChosenBed('') }} />
                      <span className="font-semibold text-gray-800">{location}</span>
                      {r.genderConstraint && <span className="text-gray-400">({r.genderConstraint})</span>}
                    </div>
                    {isChosen && isFamily && (
                      <p className="mt-1.5 text-[10px] text-gray-500 pl-5">
                        Aloca o quarto inteiro ({r.totalBeds} cama{r.totalBeds !== 1 ? 's' : ''}) — sem escolher cama específica.
                      </p>
                    )}
                    {isChosen && !isFamily && (
                      <select value={chosenBed} onChange={e => setChosenBed(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                        onClick={e => e.stopPropagation()}>
                        <option value="">Selecione a cama…</option>
                        {r.availableBeds.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                      </select>
                    )}
                  </label>
                )
              })}
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          {filteredRooms.length > 0 && (
            <button type="button" onClick={confirmar} disabled={pending || !chosenRoom}
              className="w-full px-4 py-2.5 bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
              {pending ? 'Alocando…' : '✓ Confirmar e alocar agora'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function ServiceRequestsPanel({ requests, title, handleStatusUpdate, resolverComAlocacao, resolverComAlocacaoQuarto, markEmAnalise, organizationId, slug }: Props) {
  const [selected, setSelected] = useState<ServiceReq | null>(null)
  const sidebarLeftClass = useSidebarLeftClass()

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
          className={`fixed inset-0 ${sidebarLeftClass} z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`}
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
                {selected.status === 'pendente' && !HOSPEDAGEM_TYPES.includes(selected.request_type) && (
                  <form action={handleStatusUpdate}>
                    <input type="hidden" name="request_id" value={selected.id} />
                    <SubmitButton
                      name="status" value="em_analise"
                      className="w-full px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors"
                    >
                      Marcar como Em análise
                    </SubmitButton>
                  </form>
                )}
                {selected.status !== 'resolvido' && (
                  HOSPEDAGEM_TYPES.includes(selected.request_type) ? (
                    resolverComAlocacao && organizationId ? (
                      <HospedagemResolver
                        req={selected}
                        organizationId={organizationId}
                        resolverComAlocacao={resolverComAlocacao}
                        resolverComAlocacaoQuarto={resolverComAlocacaoQuarto}
                        markEmAnalise={markEmAnalise}
                        handleStatusUpdate={handleStatusUpdate}
                        onDone={() => setSelected(null)}
                        slug={slug}
                      />
                    ) : (
                      // Pedido de hospedagem sem os handlers de alocação disponíveis
                      // nesta tela — nunca deixa "resolver" sem quarto/justificativa
                      // pelo atalho genérico abaixo.
                      <p className="text-xs text-gray-400 text-center py-2">
                        Abra esta solicitação pelo módulo de Hospedagem para alocar ou justificar indisponibilidade.
                      </p>
                    )
                  ) : (
                    <form action={handleStatusUpdate}>
                      <input type="hidden" name="request_id" value={selected.id} />
                      <SubmitButton
                        name="status" value="resolvido"
                        className="w-full px-4 py-2.5 bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors"
                        pendingText="Salvando…"
                      >
                        ✓ Marcar como Resolvido
                      </SubmitButton>
                    </form>
                  )
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
