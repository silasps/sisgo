'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

const GUEST_TYPES = [
  { value: 'visitante', label: 'Visitante' },
  { value: 'aluno', label: 'Aluno' },
  { value: 'obreiro', label: 'Obreiro' },
  { value: 'missionario', label: 'Missionário' },
  { value: 'convidado', label: 'Convidado' },
] as const

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  confirmada: { label: 'Confirmada', cls: 'bg-blue-100 text-blue-700' },
  checkin:    { label: 'Check-in',   cls: 'bg-green-100 text-green-700' },
  checkout:   { label: 'Check-out',  cls: 'bg-gray-100 text-gray-500' },
  cancelada:  { label: 'Cancelada',  cls: 'bg-red-100 text-red-600' },
}

const GUEST_TYPE_CLS: Record<string, string> = {
  aluno:       'bg-blue-100 text-blue-700',
  obreiro:     'bg-green-100 text-green-700',
  visitante:   'bg-orange-100 text-orange-700',
  missionario: 'bg-teal-100 text-teal-700',
  convidado:   'bg-purple-100 text-purple-700',
}

type BedOption = { id: string; label: string }

type AllocationData = {
  id: string
  guest_name: string
  guest_type: string
  bed_id: string | null
  bed_label: string | null
  check_in: string
  check_out: string
  actual_check_in: string | null
  actual_check_out: string | null
  status: string
  notes: string | null
}

type Props = {
  allocations: AllocationData[]
  beds: BedOption[]
  createAction: (formData: FormData) => Promise<void>
  checkinAction: (formData: FormData) => Promise<void>
  checkoutAction: (formData: FormData) => Promise<void>
  cancelAction: (formData: FormData) => Promise<void>
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function AllocationManager({
  allocations, beds, createAction, checkinAction, checkoutAction, cancelAction,
}: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const active  = allocations.filter(a => a.status !== 'checkout' && a.status !== 'cancelada')
  const history = allocations.filter(a => a.status === 'checkout' || a.status === 'cancelada')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">
          Ocupantes {active.length > 0 && `(${active.length})`}
        </h3>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="text-xs font-medium text-brand-500 hover:text-brand-700 transition-colors"
        >
          + Nova alocação
        </button>
      </div>

      {active.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          Nenhum ocupante no momento.
        </p>
      ) : (
        <ul className="space-y-2">
          {active.map(a => {
            const st = STATUS_LABELS[a.status] ?? STATUS_LABELS.confirmada
            const gt = GUEST_TYPES.find(t => t.value === a.guest_type)?.label ?? a.guest_type
            const gtCls = GUEST_TYPE_CLS[a.guest_type] ?? 'bg-gray-100 text-gray-600'

            return (
              <li key={a.id} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{a.guest_name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${gtCls}`}>{gt}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                      {a.bed_label && (
                        <span className="text-[10px] text-gray-400">Cama: {a.bed_label}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                    {fmt(a.check_in)} → {fmt(a.check_out)}
                  </p>
                </div>

                {a.notes && (
                  <p className="text-[10px] text-gray-400 italic">{a.notes}</p>
                )}

                <div className="flex gap-2 pt-1">
                  {a.status === 'confirmada' && (
                    <form action={checkinAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="bed_id" value={a.bed_id ?? ''} />
                      <button
                        type="submit"
                        className="px-3 py-1 text-[10px] font-medium bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
                      >
                        Check-in
                      </button>
                    </form>
                  )}
                  {a.status === 'checkin' && (
                    <form action={checkoutAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="bed_id" value={a.bed_id ?? ''} />
                      <button
                        type="submit"
                        className="px-3 py-1 text-[10px] font-medium bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors"
                      >
                        Check-out
                      </button>
                    </form>
                  )}
                  {(a.status === 'confirmada' || a.status === 'checkin') && (
                    <form action={cancelAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="bed_id" value={a.bed_id ?? ''} />
                      <button
                        type="submit"
                        className="px-3 py-1 text-[10px] font-medium border border-red-200 text-red-500 rounded-md hover:bg-red-50 transition-colors"
                      >
                        Cancelar
                      </button>
                    </form>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {history.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
            Histórico ({history.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {history.map(a => {
              const st = STATUS_LABELS[a.status] ?? STATUS_LABELS.checkout
              const gt = GUEST_TYPES.find(t => t.value === a.guest_type)?.label ?? a.guest_type
              return (
                <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 text-xs text-gray-500">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-gray-700 truncate">{a.guest_name}</span>
                    <span className="text-gray-400">{gt}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                  </div>
                  <span className="text-gray-400 whitespace-nowrap flex-shrink-0">
                    {fmt(a.check_in)} → {fmt(a.check_out)}
                  </span>
                </li>
              )
            })}
          </ul>
        </details>
      )}

      {/* New Allocation Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nova Alocação" hideFooter>
        <form action={createAction} className="p-5 space-y-4" onSubmit={() => setShowAdd(false)}>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome do hóspede *</label>
            <input
              name="guest_name"
              required
              placeholder="Nome completo"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
              <select
                name="guest_type"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {GUEST_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cama</label>
              <select
                name="bed_id"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="">Sem cama específica</option>
                {beds.map(b => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-in *</label>
              <input
                name="check_in"
                type="date"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-out *</label>
              <input
                name="check_out"
                type="date"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
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

          <button
            type="submit"
            className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Alocar Hóspede
          </button>
        </form>
      </Modal>
    </div>
  )
}
