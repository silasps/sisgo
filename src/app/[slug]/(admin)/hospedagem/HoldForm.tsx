'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

type Option = { id: string; name: string }

type Props = {
  createAction: (formData: FormData) => Promise<void>
  scope: 'block' | 'floor' | 'room'
  label: string
  // scope='block': lista de blocos pra escolher.
  blockOptions?: Option[]
  // scope='floor': bloco já é fixo (você está dentro dele), escolhe o andar.
  blockId?: string
  floorOptions?: Option[]
  // scope='room': bloco e andar já são fixos, escolhe o quarto.
  floorId?: string
  roomOptions?: Option[]
  trigger?: React.ReactNode
}

const SCOPE_LABEL: Record<Props['scope'], string> = {
  block: 'bloco',
  floor: 'andar',
  room: 'quarto',
}

export function HoldForm({ createAction, scope, label, blockOptions, blockId, floorOptions, floorId, roomOptions, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const options = scope === 'block' ? blockOptions : scope === 'floor' ? floorOptions : roomOptions
  const optionFieldName = scope === 'block' ? 'block_id' : scope === 'floor' ? 'floor_id' : 'room_id'
  const canSubmit = (options?.length ?? 0) > 0

  return (
    <>
      <span onClick={() => canSubmit && setOpen(true)}>
        {trigger ?? (
          <button
            type="button"
            disabled={!canSubmit}
            className="px-3 py-1.5 text-xs font-medium border border-brand-200 text-brand-600 hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Reservar {SCOPE_LABEL[scope]} inteiro
          </button>
        )}
      </span>

      <Modal open={open} onClose={() => setOpen(false)} title={`Reservar ${SCOPE_LABEL[scope]} inteiro`} hideFooter>
        <form action={createAction} className="p-5 space-y-4" onSubmit={() => setOpen(false)}>
          <input type="hidden" name="scope" value={scope} />
          {scope !== 'block' && <input type="hidden" name="block_id" value={blockId} />}
          {scope === 'room' && <input type="hidden" name="floor_id" value={floorId} />}

          <p className="text-xs text-gray-400">
            Isso só marca um bloqueio/aviso — não aloca nenhuma cama. A distribuição cama a cama continua sendo feita depois, aos poucos.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {scope === 'block' ? 'Bloco' : scope === 'floor' ? `Andar (${label})` : `Quarto (${label})`} *
            </label>
            <select
              name={optionFieldName}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {(options ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Grupo / Nome *</label>
            <input
              name="group_name"
              required
              placeholder="Ex: Equipe missionária de outubro"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Início *</label>
              <input name="starts_at" type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fim *</label>
              <input name="ends_at" type="date" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Informações adicionais..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>

          <button type="submit" className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
            Reservar {SCOPE_LABEL[scope]}
          </button>
        </form>
      </Modal>
    </>
  )
}
