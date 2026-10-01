'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { BedDouble, Check, ChevronDown, Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { normalize, rankRooms, suggestRooms, type RoomOption } from './roomRanking'

type Action = (formData: FormData) => Promise<void>

/** Resposta de aprovar/definir quarto quando não deu (a vaga foi ocupada no meio tempo); sucesso redireciona. */
export type DecisionState = { error: string } | null
type DecisionAction = (state: DecisionState, formData: FormData) => Promise<DecisionState>

export type ReservationInfo = {
  id: string
  title: string
  type: 'espaco' | 'quarto'
  period: string // "30/09/2026 → 10/10/2026 · 10 noites"
  guestsCount: number | null
  guestsDescription: string | null
  requested: string | null // "Espaço/quarto desejado" escrito por quem pediu
}

type Selection = { roomId: string; whole: boolean; bedIds: string[] }
type Tone = 'approve' | 'danger' | 'brand'

const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
const SECTION_LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-gray-400'
const BUTTON = 'inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors'
const TONES: Record<Tone, string> = {
  approve: 'bg-green-600 font-semibold text-white hover:bg-green-700',
  danger: 'border border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600',
  brand: 'border border-brand-400/50 bg-white text-brand-600 hover:bg-brand-500/10',
}
const GENDER_LABEL: Record<string, string> = { masculino: 'Masculino', feminino: 'Feminino', misto: 'Misto' }

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function roomDetails(room: RoomOption, withPlace = true) {
  return [withPlace ? room.place : null, room.gender ? GENDER_LABEL[room.gender] ?? room.gender : null].filter(Boolean).join(' · ')
}

function RoomRow({ room, need, onPick, cited, withPlace = true }: {
  room: RoomOption; need: number; onPick: (room: RoomOption) => void; cited?: boolean; withPlace?: boolean
}) {
  const free = room.beds.length
  const fits = free >= need
  const details = roomDetails(room, withPlace)
  return (
    <button type="button" onClick={() => onPick(room)}
      className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-400/60 hover:shadow-md">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${fits ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
        <BedDouble className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-gray-900 group-hover:text-brand-600">{room.name}</span>
          {cited && <span className="shrink-0 rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">citado no pedido</span>}
        </span>
        {details && <span className="block truncate text-xs text-gray-400">{details}</span>}
      </span>
      <span className={`shrink-0 text-right text-xs font-semibold ${fits ? 'text-green-700' : 'text-gray-500'}`}>
        {free} de {room.totalBeds}
        <span className="block text-[10px] font-normal text-gray-400">{free === 1 ? 'cama livre' : 'camas livres'}</span>
      </span>
    </button>
  )
}

function BedChooser({ room, need, needKnown, selection, onSelect }: {
  room: RoomOption; need: number; needKnown: boolean; selection: Selection; onSelect: (s: Selection | null) => void
}) {
  const defaultBeds = room.beds.slice(0, need).map(b => b.id)
  const count = selection.whole ? room.totalBeds : selection.bedIds.length
  const forWhom = needKnown ? ` para ${plural(need, 'pessoa', 'pessoas')}` : ''
  const short = needKnown && count > 0 && count < need
  const details = roomDetails(room)

  const toggleWhole = () => onSelect(selection.whole
    ? { ...selection, whole: false, bedIds: selection.bedIds.length > 0 ? selection.bedIds : defaultBeds }
    : { ...selection, whole: true })
  const toggleBed = (bedId: string) => onSelect({
    ...selection,
    bedIds: selection.bedIds.includes(bedId) ? selection.bedIds.filter(id => id !== bedId) : [...selection.bedIds, bedId],
  })

  return (
    <div className="space-y-3 rounded-xl border border-brand-400/40 bg-brand-500/5 p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
          <BedDouble className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{room.name}</p>
          {details && <p className="truncate text-xs text-gray-500">{details}</p>}
        </div>
        <button type="button" onClick={() => onSelect(null)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-500/10">
          Trocar
        </button>
      </div>

      {room.wholeRoomAvailable && (
        <button type="button" onClick={toggleWhole} aria-pressed={selection.whole}
          className={`flex w-full items-center gap-2.5 rounded-lg border bg-white px-3 py-2 text-left text-sm transition-colors ${selection.whole ? 'border-brand-500 text-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
          <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${selection.whole ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-300'}`}>
            {selection.whole && <Check className="size-3" />}
          </span>
          Quarto inteiro
          <span className="text-gray-400">· {plural(room.totalBeds, 'cama', 'camas')}</span>
        </button>
      )}

      {!selection.whole && room.beds.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-600">Camas</p>
          <div className="flex flex-wrap gap-1.5">
            {room.beds.map(bed => {
              const on = selection.bedIds.includes(bed.id)
              return (
                <button key={bed.id} type="button" onClick={() => toggleBed(bed.id)} aria-pressed={on}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${on ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                  {on && <Check className="size-3" />}
                  {bed.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <p className={`text-xs ${count === 0 || short ? 'text-amber-700' : 'text-gray-500'}`}>
        {count === 0
          ? 'Escolha ao menos uma cama.'
          : selection.whole
            ? `Quarto inteiro${forWhom}.`
            : `${plural(count, 'cama', 'camas')}${forWhom}${short ? ` — faltam ${need - count}; o resto dá pra alocar em Hospedagem.` : '.'}`}
      </p>
    </div>
  )
}

function RoomPicker({ rooms, need, needKnown, requested, selection, onSelect }: {
  rooms: RoomOption[]; need: number; needKnown: boolean; requested: string
  selection: Selection | null; onSelect: (s: Selection | null) => void
}) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const ranked = useMemo(() => rankRooms(rooms, need, requested), [rooms, need, requested])
  const anyFits = ranked.some(r => r.free >= need)
  const suggestions = useMemo(() => suggestRooms(ranked, need), [ranked, need])
  // Lista completa agrupada por bloco/andar, na ordem de exibição dos quartos.
  const groups = useMemo(() => {
    const byPlace = new Map<string, RoomOption[]>()
    for (const room of rooms) {
      const key = room.place ?? 'Outros quartos'
      byPlace.set(key, [...(byPlace.get(key) ?? []), room])
    }
    return [...byPlace]
  }, [rooms])

  const selectedRoom = selection ? rooms.find(r => r.id === selection.roomId) : undefined
  if (selection && selectedRoom) {
    return <BedChooser room={selectedRoom} need={need} needKnown={needKnown} selection={selection} onSelect={onSelect} />
  }

  // Já sugere as camas: quarto inteiro quando o grupo ocupa tudo, senão as
  // primeiras camas livres pra quantidade de pessoas do pedido.
  const pick = (room: RoomOption) => {
    const whole = room.wholeRoomAvailable && (need >= room.totalBeds || room.beds.length === 0)
    onSelect({ roomId: room.id, whole, bedIds: whole ? [] : room.beds.slice(0, need).map(b => b.id) })
  }
  const q = normalize(query)
  const results = q ? ranked.filter(r => normalize(`${r.room.name} ${r.room.place ?? ''}`).includes(q)) : []

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar quarto, bloco ou andar…"
          className={`${INPUT} pl-9`} />
      </div>

      {q ? (
        results.length > 0 ? (
          <div className="space-y-2">
            {results.map(r => <RoomRow key={r.room.id} room={r.room} need={need} onPick={pick} cited={r.mention === 2} />)}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-gray-400">Nenhum quarto com vaga encontrado para “{query}”.</p>
        )
      ) : (
        <>
          <div className="space-y-2">
            <p className={SECTION_LABEL}>{needKnown ? `Sugeridos para ${plural(need, 'pessoa', 'pessoas')}` : 'Sugeridos'}</p>
            {needKnown && !anyFits && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Nenhum quarto tem {need} camas livres juntas nessas datas. Escolha o que chega mais perto e aloque o resto em Hospedagem.
              </p>
            )}
            {suggestions.map(r => <RoomRow key={r.room.id} room={r.room} need={need} onPick={pick} cited={r.mention === 2} />)}
          </div>

          {rooms.length > suggestions.length && (
            <div>
              <button type="button" onClick={() => setShowAll(v => !v)}
                className="flex w-full items-center justify-between rounded-lg py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-800">
                {showAll ? 'Esconder lista completa' : `Ver todos os ${rooms.length} quartos com vaga`}
                <ChevronDown className={`size-4 transition-transform ${showAll ? 'rotate-180' : ''}`} />
              </button>
              {showAll && (
                <div className="mt-2 space-y-4">
                  {groups.map(([place, list]) => (
                    <div key={place} className="space-y-2">
                      <p className={SECTION_LABEL}>{place}</p>
                      {list.map(room => <RoomRow key={room.id} room={room} need={need} onPick={pick} withPlace={false} />)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Aprovar uma reserva (escolhendo quarto/camas ou deixando pra depois) ou,
 * com `variant="quarto"`, definir/trocar o quarto de uma já aprovada. A lista
 * de quartos livres só é buscada quando o diálogo abre — fresca na hora de
 * escolher e sem pesar o carregamento da página.
 */
export function ReservationDecisionButton({ variant, reservation, action, loadRooms, currentRoom, label, tone }: {
  variant: 'aprovar' | 'quarto'
  reservation: ReservationInfo
  action: DecisionAction
  loadRooms: (reservationId: string) => Promise<RoomOption[]>
  currentRoom?: string | null
  label: string
  tone: Tone
}) {
  const [open, setOpen] = useState(false)
  const [rooms, setRooms] = useState<RoomOption[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [later, setLater] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Erro volta dentro do próprio diálogo (um aviso na página ficaria atrás
  // dele): mostra o motivo, limpa a escolha e recarrega a lista de quartos.
  const [state, formAction] = useActionState(action, null)
  const [seenState, setSeenState] = useState<DecisionState>(null)
  if (state !== seenState) {
    setSeenState(state)
    if (state?.error) {
      setError(state.error)
      setSelection(null)
      setRooms(null)
    }
  }

  const needsRoom = reservation.type === 'quarto'
  const needKnown = (reservation.guestsCount ?? 0) > 0
  const need = Math.max(1, reservation.guestsCount ?? 1)
  const requested = normalize(reservation.requested ?? '')

  useEffect(() => {
    if (!open || !needsRoom || rooms) return
    let cancelled = false
    loadRooms(reservation.id)
      .then(result => { if (!cancelled) setRooms(result) })
      .catch(() => { if (!cancelled) setLoadFailed(true) })
    return () => { cancelled = true }
  }, [open, needsRoom, rooms, attempt, loadRooms, reservation.id])

  // Fechar descarta a lista: na próxima abertura ela vem atualizada (outra
  // aprovação pode ter ocupado um quarto nesse meio tempo).
  const close = () => {
    setOpen(false)
    setSelection(null)
    setLater(false)
    setError(null)
    setRooms(null)
    setLoadFailed(false)
  }

  const noRooms = rooms !== null && rooms.length === 0
  const validSelection = !!selection && (selection.whole || selection.bedIds.length > 0)
  const sendRoom = needsRoom && !later && validSelection && selection
  const canSubmit = variant === 'quarto'
    ? validSelection
    : !needsRoom || later || noRooms || validSelection

  const requestSummary = [
    reservation.requested ? `“${reservation.requested}”` : null,
    needKnown ? plural(need, 'pessoa', 'pessoas') : null,
    reservation.guestsDescription,
  ].filter(Boolean).join(' · ')

  const title = variant === 'aprovar' ? 'Aprovar reserva' : currentRoom ? 'Trocar quarto' : 'Definir quarto'

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${BUTTON} ${TONES[tone]}`}>
        {variant === 'aprovar' ? <Check className="size-4" /> : <BedDouble className="size-4" />}
        {label}
      </button>

      <Modal open={open} onClose={close} title={title} subtitle={`${reservation.title} · ${reservation.period}`}
        hideFooter closeOnBackdropClick={false}>
        <form action={formAction}>
          <input type="hidden" name="reservation_id" value={reservation.id} />
          <input type="hidden" name="room_mode" value={sendRoom ? (sendRoom.whole ? 'quarto' : 'camas') : ''} />
          <input type="hidden" name="room_id" value={sendRoom ? sendRoom.roomId : ''} />
          <input type="hidden" name="bed_ids" value={sendRoom && !sendRoom.whole ? sendRoom.bedIds.join(',') : ''} />

          <div className="space-y-5 p-5">
            {error && <p className="rounded-xl bg-red-50 px-3.5 py-3 text-xs font-medium text-red-600">{error}</p>}

            {requestSummary && (
              <div className="rounded-xl bg-gray-50 px-3.5 py-3">
                <p className={SECTION_LABEL}>Pedido</p>
                <p className="mt-0.5 text-sm text-gray-700">{requestSummary}</p>
              </div>
            )}

            {needsRoom && (
              <section className="space-y-3">
                {variant === 'aprovar' ? (
                  <>
                    <h3 className="text-sm font-semibold text-gray-900">Onde vai ficar?</h3>
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
                      {([['Escolher quarto', false], ['Decidir depois', true]] as const).map(([text, value]) => (
                        <button key={text} type="button" onClick={() => setLater(value)} aria-pressed={later === value}
                          className={`rounded-lg py-2 text-sm font-medium transition-colors ${later === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          {text}
                        </button>
                      ))}
                    </div>
                  </>
                ) : currentRoom && (
                  <p className="text-xs text-gray-500">
                    Agora: <span className="font-medium text-gray-700">{currentRoom}</span>. Ele é liberado quando você salvar o novo.
                  </p>
                )}

                {later ? (
                  <p className="rounded-xl bg-gray-50 px-3.5 py-3 text-xs text-gray-500">
                    A reserva é aprovada sem quarto. Quando decidir, use “Definir quarto” no cartão dela e quem pediu é avisado.
                  </p>
                ) : rooms === null ? (
                  loadFailed ? (
                    <div className="rounded-xl bg-red-50 px-3.5 py-3 text-xs text-red-600">
                      Não deu pra carregar os quartos.{' '}
                      <button type="button" className="font-semibold underline"
                        onClick={() => { setLoadFailed(false); setAttempt(a => a + 1) }}>
                        Tentar de novo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2" aria-busy="true">
                      {[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />)}
                    </div>
                  )
                ) : noRooms ? (
                  <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-xs text-amber-700">
                    Nenhum quarto com vaga nessas datas.{variant === 'aprovar' && ' Dá pra aprovar assim mesmo e definir o quarto depois.'}
                  </p>
                ) : (
                  <RoomPicker rooms={rooms} need={need} needKnown={needKnown} requested={requested}
                    selection={selection} onSelect={setSelection} />
                )}
              </section>
            )}

            {variant === 'aprovar' && (
              <section className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Recado para quem pediu <span className="font-normal text-gray-400">(opcional)</span>
                  </label>
                  <textarea name="review_notes" rows={2} className={`${INPUT} resize-none`}
                    placeholder={needsRoom ? 'Ex.: chegada até as 18h, roupa de cama inclusa' : 'Ex.: sala grande confirmada, chave na recepção'} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Valor cobrado <span className="font-normal text-gray-400">(opcional)</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                    <input name="final_cost" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0,00"
                      className={`${INPUT} pl-10`} />
                  </div>
                </div>
              </section>
            )}
          </div>

          <div className="sticky bottom-0 flex gap-3 border-t border-gray-100 bg-white px-5 py-3">
            <button type="button" onClick={close}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50">
              Cancelar
            </button>
            <SubmitButton disabled={!canSubmit} pendingText="Salvando…"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50">
              {variant === 'aprovar' ? 'Confirmar reserva' : 'Salvar quarto'}
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  )
}

/**
 * Ação que pede só um motivo opcional (recusar, cancelar reserva/alocação) —
 * um botão no cartão que abre a confirmação, em vez de campo solto na lista.
 */
export function ReasonActionButton({ action, hidden, fieldName, label, title, subtitle, hint, confirmLabel, pendingText }: {
  action: Action
  hidden: Record<string, string>
  fieldName: string
  label: string
  title: string
  subtitle?: string
  hint: string
  confirmLabel: string
  pendingText: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${BUTTON} ${TONES.danger}`}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} subtitle={subtitle} hideFooter>
        <form action={action}>
          {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <div className="space-y-3 p-5">
            <p className="text-sm text-gray-600">{hint}</p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Motivo <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <textarea name={fieldName} rows={3} className={`${INPUT} resize-none`} />
            </div>
          </div>
          <div className="flex gap-3 border-t border-gray-100 px-5 py-3">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50">
              Voltar
            </button>
            <SubmitButton pendingText={pendingText}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  )
}
