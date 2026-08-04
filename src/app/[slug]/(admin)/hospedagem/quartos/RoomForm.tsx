'use client'

import { useMemo, useState } from 'react'
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

const DESTINATION_OPTIONS = [
  { value: 'visita', label: 'Visitantes' },
  { value: 'aluno', label: 'Alunos (ETED/EMF)' },
  { value: 'obreiro', label: 'Obreiros' },
] as const

const MODE_OPTIONS = [
  { value: 'quarto', label: 'Quarto inteiro' },
  { value: 'cama', label: 'Cama individual' },
] as const

type RoomData = {
  id: string
  name: string
  floorId: string
  type: string
  gender_constraint: string | null
  destination: string
  allocation_mode: string
  status: string
  notes: string | null
}

type FloorOption = {
  id: string
  name: string
  blockName: string
  destination: string | null
  genderConstraint: string | null
}

type Props = {
  createAction: (formData: FormData) => Promise<void>
  editAction: (formData: FormData) => Promise<void>
  floors: FloorOption[]
  room?: RoomData | null
  defaultFloorId?: string
  trigger?: React.ReactNode
}

export function RoomForm({ createAction, editAction, floors, room, defaultFloorId, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const isEdit = !!room
  const [floorId, setFloorId] = useState(room?.floorId ?? defaultFloorId ?? floors[0]?.id ?? '')

  const floorsByBlock = useMemo(() => {
    const map = new Map<string, FloorOption[]>()
    for (const f of floors) map.set(f.blockName, [...(map.get(f.blockName) ?? []), f])
    return map
  }, [floors])

  // Andar carrega um público/gênero padrão — só pré-preenche o quarto NOVO
  // (troca o `key` do select pra remontar com o novo default quando o andar
  // muda); editando um quarto existente, o valor de sempre é o do próprio
  // quarto, o andar não sobrescreve nada.
  const selectedFloor = floors.find(f => f.id === floorId)
  const destinationDefault = isEdit ? (room?.destination ?? 'visita') : (selectedFloor?.destination ?? 'visita')
  const genderDefault = isEdit ? (room?.gender_constraint ?? '') : (selectedFloor?.genderConstraint ?? '')

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

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Andar *</label>
            <select
              name="floor_id"
              required
              value={floorId}
              onChange={e => setFloorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {floors.length === 0 && <option value="">Crie um bloco e andar primeiro</option>}
              {[...floorsByBlock.entries()].map(([blockName, blockFloors]) => (
                <optgroup key={blockName} label={blockName}>
                  {blockFloors.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gênero</label>
              <select
                key={isEdit ? 'edit-gender' : `gender-${floorId}`}
                name="gender_constraint"
                defaultValue={genderDefault}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {GENDER_OPTIONS.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Destinado a *</label>
              <select
                key={isEdit ? 'edit-destination' : `destination-${floorId}`}
                name="destination"
                required
                defaultValue={destinationDefault}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {DESTINATION_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Modo de alocação *</label>
              <select
                name="allocation_mode"
                required
                defaultValue={room?.allocation_mode ?? 'quarto'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {MODE_OPTIONS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
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
            disabled={floors.length === 0}
            className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isEdit ? 'Salvar Alterações' : 'Criar Quarto'}
          </button>
        </form>
      </Modal>
    </>
  )
}
