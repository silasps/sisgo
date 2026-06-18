'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

const BED_TYPES = [
  { value: 'solteiro', label: 'Solteiro' },
  { value: 'casal', label: 'Casal' },
  { value: 'beliche_sup', label: 'Beliche Superior' },
  { value: 'beliche_inf', label: 'Beliche Inferior' },
  { value: 'colchao', label: 'Colchão' },
] as const

const BED_STATUS = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'ocupada', label: 'Ocupada' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'reservada', label: 'Reservada' },
] as const

const STATUS_STYLE: Record<string, string> = {
  disponivel: 'border-green-300 bg-green-50',
  ocupada:    'border-blue-300 bg-blue-50',
  manutencao: 'border-yellow-300 bg-yellow-50',
  reservada:  'border-purple-300 bg-purple-50',
}

const STATUS_DOT: Record<string, string> = {
  disponivel: 'bg-green-400',
  ocupada:    'bg-blue-400',
  manutencao: 'bg-yellow-400',
  reservada:  'bg-purple-400',
}

type BedData = {
  id: string
  label: string
  type: string
  status: string
  notes: string | null
  occupant?: string | null
}

type Props = {
  beds: BedData[]
  addAction: (formData: FormData) => Promise<void>
  editAction: (formData: FormData) => Promise<void>
  removeAction: (formData: FormData) => Promise<void>
}

export function BedManager({ beds, addAction, editAction, removeAction }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [editBed, setEditBed] = useState<BedData | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">
          Camas ({beds.length})
        </h3>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="text-xs font-medium text-brand-500 hover:text-brand-700 transition-colors"
        >
          + Adicionar cama
        </button>
      </div>

      {beds.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">
          Nenhuma cama cadastrada neste quarto.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {beds.map(bed => {
            const typeLabel = BED_TYPES.find(t => t.value === bed.type)?.label ?? bed.type
            const statusLabel = BED_STATUS.find(s => s.value === bed.status)?.label ?? bed.status

            return (
              <button
                key={bed.id}
                type="button"
                onClick={() => setEditBed(bed)}
                className={`text-left p-3 rounded-lg border-2 transition-all hover:shadow-sm ${
                  STATUS_STYLE[bed.status] ?? 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[bed.status] ?? 'bg-gray-300'}`} />
                  <span className="text-sm font-medium text-gray-900 truncate">{bed.label}</span>
                </div>
                <p className="text-[10px] text-gray-500">{typeLabel}</p>
                <p className="text-[10px] text-gray-400">{statusLabel}</p>
                {bed.occupant && (
                  <p className="text-[10px] text-blue-600 font-medium mt-1 truncate">{bed.occupant}</p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Add Bed Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Adicionar Cama" hideFooter>
        <form action={addAction} className="p-5 space-y-4" onSubmit={() => setShowAdd(false)}>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome/Rótulo *</label>
            <input
              name="label"
              required
              placeholder="Ex: Cama 1, Beliche A - Superior"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
            <select
              name="type"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {BED_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Adicionar
          </button>
        </form>
      </Modal>

      {/* Edit Bed Modal */}
      {editBed && (
        <Modal open onClose={() => setEditBed(null)} title={`Editar: ${editBed.label}`} hideFooter>
          <form action={editAction} className="p-5 space-y-4" onSubmit={() => setEditBed(null)}>
            <input type="hidden" name="id" value={editBed.id} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome/Rótulo *</label>
              <input
                name="label"
                required
                defaultValue={editBed.label}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select
                  name="type"
                  defaultValue={editBed.type}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  {BED_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue={editBed.status}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  {BED_STATUS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
              <textarea
                name="notes"
                rows={2}
                defaultValue={editBed.notes ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Salvar
              </button>
              <ConfirmDialog
                title="Remover cama"
                message={`Tem certeza que deseja remover "${editBed.label}"? Esta ação não pode ser desfeita.`}
                confirmLabel="Remover"
                onConfirm={async () => {
                  const fd = new FormData()
                  fd.set('id', editBed.id)
                  await removeAction(fd)
                  setEditBed(null)
                }}
              >
                <button
                  type="button"
                  className="px-4 py-2 border border-red-200 text-red-500 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
                >
                  Remover
                </button>
              </ConfirmDialog>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
