'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

const ROOM_TYPES = [
  { value: 'quarto', label: 'Quarto' },
  { value: 'suite', label: 'Suíte' },
  { value: 'dormitorio', label: 'Dormitório' },
  { value: 'casal', label: 'Casal' },
] as const

const GENDER_OPTIONS = [
  { value: '', label: 'Sem restrição' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'misto', label: 'Misto' },
] as const

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'inativo', label: 'Inativo' },
] as const

type RoomData = {
  id: string
  name: string
  floor: string | null
  type: string
  gender_constraint: string | null
  status: string
  notes: string | null
}

type Props = {
  createAction: (formData: FormData) => Promise<void>
  editAction: (formData: FormData) => Promise<void>
  room?: RoomData | null
  trigger?: React.ReactNode
}

export function RoomForm({ createAction, editAction, room, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const isEdit = !!room

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <button
            type="button"
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Novo Quarto
          </button>
        )}
      </span>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? 'Editar Quarto' : 'Novo Quarto'}
        hideFooter
      >
        <form
          action={isEdit ? editAction : createAction}
          className="p-5 space-y-4"
          onSubmit={() => setOpen(false)}
        >
          {isEdit && <input type="hidden" name="id" value={room.id} />}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome do quarto *</label>
            <input
              name="name"
              required
              defaultValue={room?.name ?? ''}
              placeholder="Ex: Quarto 101, Alojamento A"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Andar</label>
              <input
                name="floor"
                defaultValue={room?.floor ?? ''}
                placeholder="Ex: Térreo, 1º Andar"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
              <select
                name="type"
                required
                defaultValue={room?.type ?? 'quarto'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {ROOM_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gênero</label>
              <select
                name="gender_constraint"
                defaultValue={room?.gender_constraint ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {GENDER_OPTIONS.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue={room?.status ?? 'ativo'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={room?.notes ?? ''}
              placeholder="Informações adicionais sobre o quarto..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isEdit ? 'Salvar Alterações' : 'Criar Quarto'}
          </button>
        </form>
      </Modal>
    </>
  )
}
