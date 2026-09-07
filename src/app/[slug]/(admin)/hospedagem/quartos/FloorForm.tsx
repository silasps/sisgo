'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

const DESTINATION_OPTIONS = [
  { value: '', label: 'Sem padrão' },
  { value: 'visita', label: 'Visitantes' },
  { value: 'aluno', label: 'Alunos (ETED/EMF)' },
  { value: 'obreiro', label: 'Obreiros' },
] as const

const GENDER_OPTIONS = [
  { value: '', label: 'Sem padrão' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'misto', label: 'Misto' },
] as const

type FloorData = { id: string; name: string; destination: string | null; gender_constraint: string | null }

type Props = {
  createAction: (formData: FormData) => Promise<void>
  editAction: (formData: FormData) => Promise<void>
  blockId: string
  floor?: FloorData | null
  trigger?: React.ReactNode
}

export function FloorForm({ createAction, editAction, blockId, floor, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const isEdit = !!floor

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <button type="button" className="text-xs font-medium text-brand-500 hover:text-brand-700 transition-colors">
            + Andar
          </button>
        )}
      </span>

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? 'Editar andar' : 'Novo andar'} hideFooter>
        <form action={isEdit ? editAction : createAction} className="p-5 space-y-4" onSubmit={() => setOpen(false)}>
          {isEdit && <input type="hidden" name="id" value={floor.id} />}
          <input type="hidden" name="block_id" value={blockId} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome do andar *</label>
            <input
              name="name"
              required
              defaultValue={floor?.name ?? ''}
              placeholder="Ex: Térreo, 1º Andar"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            Público e gênero abaixo são só um padrão — pré-preenchem quarto novo criado neste andar, mas cada quarto pode ser diferente.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Destinado a (padrão)</label>
              <select
                name="destination"
                defaultValue={floor?.destination ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {DESTINATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gênero (padrão)</label>
              <select
                name="gender_constraint"
                defaultValue={floor?.gender_constraint ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {GENDER_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
            {isEdit ? 'Salvar' : 'Criar andar'}
          </button>
        </form>
      </Modal>
    </>
  )
}
