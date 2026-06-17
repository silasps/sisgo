'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

type Payable = { id: string; description: string; supplier: string | null; amount: number; due_date: string; status: string; recurrence: string; finance_categories: { name: string } | null }
type KpiType = 'overdue' | 'month' | 'paid'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR')
const RECURRENCE: Record<string, string> = { once: 'Único', monthly: 'Mensal', annual: 'Anual' }

export function ContasPagarKpiCards({ totalOverdue, totalMonth, totalPaid, overdueItems, dueThisMonth, paidItems }: {
  totalOverdue: number; totalMonth: number; totalPaid: number
  overdueItems: Payable[]; dueThisMonth: Payable[]; paidItems: Payable[]
}) {
  const [open, setOpen] = useState<KpiType | null>(null)

  const kpis: Array<{ type: KpiType; value: string; label: string; sub: string; bg: string; val: string; border: string }> = [
    { type: 'overdue', value: fmt(totalOverdue), label: 'Vencidas',            sub: `${overdueItems.length} conta${overdueItems.length !== 1 ? 's' : ''}`, bg: totalOverdue > 0 ? 'bg-red-50' : 'bg-white', val: totalOverdue > 0 ? 'text-red-600' : 'text-gray-900', border: totalOverdue > 0 ? 'border-red-100' : 'border-gray-200' },
    { type: 'month',   value: fmt(totalMonth),   label: 'A pagar este mês',    sub: `${dueThisMonth.length} conta${dueThisMonth.length !== 1 ? 's' : ''}`,  bg: 'bg-yellow-50', val: 'text-yellow-600', border: 'border-yellow-100' },
    { type: 'paid',    value: fmt(totalPaid),    label: 'Pago (registrado)',   sub: `${paidItems.length} conta${paidItems.length !== 1 ? 's' : ''}`,         bg: 'bg-green-50',  val: 'text-green-600',  border: 'border-green-100' },
  ]

  const modalTitle: Record<KpiType, string> = { overdue: 'Contas vencidas', month: 'Contas do mês', paid: 'Contas pagas' }
  const list = open === 'overdue' ? overdueItems : open === 'month' ? dueThisMonth : open === 'paid' ? paidItems : []

  return (
    <>
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-stagger">
        {kpis.map(k => (
          <button key={k.type} onClick={() => setOpen(k.type)}
            className={`${k.bg} border ${k.border} rounded-xl p-4 text-left w-full cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0`}>
            <p className={`text-lg font-bold ${k.val}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
            <p className="text-xs text-brand-400 mt-1">Ver detalhes →</p>
          </button>
        ))}
      </section>

      <Modal open={open !== null} onClose={() => setOpen(null)}
        title={open ? modalTitle[open] : ''}
        subtitle={`${list.length} conta${list.length !== 1 ? 's' : ''}`}>
        {list.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Nenhuma conta nesta categoria.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.supplier ? `${p.supplier} · ` : ''}
                    {fmtDate(p.due_date)}
                    {p.finance_categories?.name ? ` · ${p.finance_categories.name}` : ''}
                    {' · '}<span className="italic">{RECURRENCE[p.recurrence] ?? p.recurrence}</span>
                  </p>
                </div>
                <p className="text-sm font-bold text-gray-900 flex-shrink-0">{fmt(Number(p.amount))}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}
