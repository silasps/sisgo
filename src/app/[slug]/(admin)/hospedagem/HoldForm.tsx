'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { BedDouble, Users } from 'lucide-react'

export type HoldTarget = {
  id: string
  name: string
  subtitle: string | null // ex.: "Casa Nova - Obreiras · Térreo · Fem. · Obreiros"
  summary: string // ex.: "1 cama · Modo quarto inteiro"
}

type Props = {
  createAction: (formData: FormData) => Promise<void>
  scope: 'block' | 'floor' | 'room'
  // O que dá pra reservar neste nível: blocos (tela de blocos), andares do
  // bloco aberto ou quartos do andar aberto.
  targets: HoldTarget[]
  today: string
  // scope='floor': bloco já é fixo (você está dentro dele).
  blockId?: string
  // scope='room': bloco e andar já são fixos.
  floorId?: string
  trigger?: React.ReactNode
}

const SCOPE_LABEL: Record<Props['scope'], { noun: string; title: string }> = {
  block: { noun: 'bloco', title: 'Bloco' },
  floor: { noun: 'andar', title: 'Andar' },
  room:  { noun: 'quarto', title: 'Quarto' },
}

function addDays(d: string, n: number) {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

// Mesmo layout do modal do quarto no mapa (BedGrid → "Alocar Quarto Inteiro"):
// título = o que está sendo reservado, linha cinza de resumo, cabeçalho
// verde, campos e botão grande. A função continua a de reserva pro grupo
// (space_holds) — não aloca cama nenhuma.
export function HoldForm({ createAction, scope, targets, today, blockId, floorId, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [startsAt, setStartsAt] = useState(today)
  const { noun, title } = SCOPE_LABEL[scope]
  const target = targets.find(t => t.id === selectedId) ?? targets[0]
  const optionFieldName = scope === 'block' ? 'block_id' : scope === 'floor' ? 'floor_id' : 'room_id'
  const canSubmit = targets.length > 0

  return (
    <>
      <span onClick={() => canSubmit && setOpen(true)}>
        {trigger ?? (
          <button
            type="button"
            disabled={!canSubmit}
            className="px-3 py-1.5 text-xs font-medium border border-brand-200 text-brand-600 hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Reservar {noun} inteiro
          </button>
        )}
      </span>

      {target && (
        <Modal open={open} onClose={() => setOpen(false)} title={target.name} subtitle={target.subtitle ?? undefined} hideFooter>
          <form action={createAction} className="p-5 space-y-4">
            <input type="hidden" name="scope" value={scope} />
            {scope !== 'block' && <input type="hidden" name="block_id" value={blockId} />}
            {scope === 'room' && <input type="hidden" name="floor_id" value={floorId} />}

            {targets.length > 1 ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{title} *</label>
                <select
                  name={optionFieldName}
                  required
                  value={target.id}
                  onChange={e => setSelectedId(e.target.value)}
                  className={inputCls}
                >
                  {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            ) : (
              <input type="hidden" name={optionFieldName} value={target.id} />
            )}

            <p className="text-xs text-gray-400">{target.summary}</p>

            <div className="flex items-center gap-2 text-green-600">
              <Users size={20} />
              <p className="text-sm font-semibold">Reservar este {noun} para um grupo</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grupo / Nome *</label>
              <input name="group_name" required placeholder="Ex: Equipe missionária de outubro" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Check-in *</label>
                <input name="starts_at" type="date" required value={startsAt} onChange={e => setStartsAt(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Check-out *</label>
                <input name="ends_at" type="date" required min={startsAt ? addDays(startsAt, 1) : undefined} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
              <textarea name="notes" rows={2} placeholder="Informações adicionais..." className={`${inputCls} resize-none`} />
            </div>

            <SubmitButton
              pendingText="Reservando…"
              className="w-full py-3 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <BedDouble size={18} /> Reservar {title} Inteiro
            </SubmitButton>

            <p className="text-[11px] text-gray-400 text-center">
              Só marca o {noun} como reservado pro grupo — as camas continuam sendo distribuídas depois, aos poucos.
            </p>
          </form>
        </Modal>
      )}
    </>
  )
}
