'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

type Charge = { id: string; person_name_snapshot: string | null; description: string; amount: number; due_date: string; status: string; origin: string; reference_month: string | null }
type KpiType = 'pending' | 'overdue' | 'paid' | 'count'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-600',
  paid: 'bg-green-100 text-green-700',
  waived: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
}
const STATUS_LABEL: Record<string, string> = { pending: 'Pendente', overdue: 'Atrasado', paid: 'Pago', waived: 'Dispensado', cancelled: 'Cancelado' }

export function CobrancasKpiCards({ pending, overdue, paid, pendingCount, allCharges }: {
  pending: number; overdue: number; paid: number; pendingCount: number; allCharges: Charge[]
}) {
  const [open, setOpen] = useState<KpiType | null>(null)

  const kpis: Array<{ type: KpiType; value: string; label: string; bg: string; val: string; border: string }> = [
    { type: 'pending', value: fmt(pending),      label: 'Pendente',       bg: 'bg-yellow-50', val: 'text-yellow-600', border: 'border-yellow-100' },
    { type: 'overdue', value: fmt(overdue),      label: 'Em atraso',      bg: 'bg-red-50',    val: 'text-red-600',    border: 'border-red-100' },
    { type: 'paid',    value: fmt(paid),         label: 'Recebido',       bg: 'bg-green-50',  val: 'text-green-600',  border: 'border-green-100' },
    { type: 'count',   value: String(pendingCount), label: 'Em aberto',   bg: 'bg-white',     val: 'text-gray-900',   border: 'border-gray-200' },
  ]

  const modalTitle: Record<KpiType, string> = {
    pending: 'Cobranças pendentes', overdue: 'Cobranças em atraso',
    paid: 'Cobranças pagas', count: 'Cobranças em aberto',
  }

  const list = open === 'pending' ? allCharges.filter(c => c.status === 'pending')
    : open === 'overdue' ? allCharges.filter(c => c.status === 'overdue')
    : open === 'paid'    ? allCharges.filter(c => c.status === 'paid')
    : open === 'count'   ? allCharges.filter(c => ['pending', 'overdue'].includes(c.status))
    : []

  return (
    <>
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-stagger">
        {kpis.map(k => (
          <button key={k.type} onClick={() => setOpen(k.type)}
            className={`${k.bg} border ${k.border} rounded-xl p-4 text-left w-full cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0`}>
            <p className={`text-lg font-bold ${k.val}`}>{k.value}{k.type === 'count' ? ' cobranças' : ''}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            <p className="text-xs text-brand-400 mt-1">Ver detalhes →</p>
          </button>
        ))}
      </section>

      <Modal open={open !== null} onClose={() => setOpen(null)}
        title={open ? modalTitle[open] : ''}
        subtitle={`${list.length} cobrança${list.length !== 1 ? 's' : ''}`}>
        {list.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Nenhuma cobrança nesta categoria.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.person_name_snapshot ?? '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.description}
                    {c.reference_month ? ` · ${c.reference_month}` : ''}
                    {' · '}{new Date(`${c.due_date}T00:00:00`).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                  <p className="text-sm font-bold text-gray-900">{fmt(Number(c.amount))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}
