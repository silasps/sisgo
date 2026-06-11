'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

type Tx = { description: string; amount: number; type: string; date: string; status: string; finance_categories: { name: string } | null; finance_funds: { name: string } | null }
type Charge = { description: string; amount: number; due_date: string; status: string; person_name_snapshot: string | null }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type KpiType = 'receitas' | 'despesas' | 'resultado' | 'inadimplencia'

export function FinanceiroKpiCards({ receitasMes, despesasMes, saldoMes, inadimplencia, monthIncome, monthExpense, overdueCharges }: {
  receitasMes: number; despesasMes: number; saldoMes: number; inadimplencia: number
  monthIncome: Tx[]; monthExpense: Tx[]; overdueCharges: Charge[]
}) {
  const [open, setOpen] = useState<KpiType | null>(null)

  const kpis: Array<{ type: KpiType; value: string; label: string; sub: string; bg: string; val: string; border: string }> = [
    { type: 'receitas',     value: fmt(receitasMes), label: 'Receitas (mês)',    sub: `${monthIncome.length} lançamentos`,  bg: 'bg-green-50',  val: 'text-green-600',  border: 'border-green-100' },
    { type: 'despesas',     value: fmt(despesasMes), label: 'Despesas (mês)',    sub: `${monthExpense.length} lançamentos`, bg: 'bg-red-50',    val: 'text-red-600',    border: 'border-red-100' },
    { type: 'resultado',    value: fmt(saldoMes),    label: 'Resultado do mês',  sub: saldoMes >= 0 ? 'Superávit' : 'Déficit', bg: saldoMes >= 0 ? 'bg-brand-50' : 'bg-orange-50', val: saldoMes >= 0 ? 'text-brand-600' : 'text-orange-600', border: saldoMes >= 0 ? 'border-brand-100' : 'border-orange-100' },
    { type: 'inadimplencia', value: fmt(inadimplencia), label: 'Inadimplência', sub: `${overdueCharges.length} cobranças`, bg: inadimplencia > 0 ? 'bg-red-50' : 'bg-white', val: inadimplencia > 0 ? 'text-red-600' : 'text-gray-900', border: inadimplencia > 0 ? 'border-red-100' : 'border-gray-200' },
  ]

  const modalTitle: Record<KpiType, string> = {
    receitas: 'Receitas do mês', despesas: 'Despesas do mês',
    resultado: 'Resultado do mês', inadimplencia: 'Cobranças em atraso',
  }

  const txList = open === 'receitas' ? monthIncome : open === 'despesas' ? monthExpense : open === 'resultado' ? [...monthIncome, ...monthExpense].sort((a, b) => b.date.localeCompare(a.date)) : null

  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <button key={k.type} onClick={() => setOpen(k.type)}
            className={`${k.bg} border ${k.border} rounded-xl p-4 text-left w-full cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0`}>
            <p className={`text-xl font-bold ${k.val}`}>{k.value}</p>
            <p className="text-xs font-medium text-gray-700 mt-1">{k.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
            <p className="text-xs text-brand-400 mt-1">Ver detalhes →</p>
          </button>
        ))}
      </section>

      <Modal open={open !== null} onClose={() => setOpen(null)}
        title={open ? modalTitle[open] : ''}
        subtitle={open === 'inadimplencia' ? `${overdueCharges.length} cobranças` : `${txList?.length ?? 0} lançamentos`}>

        {open === 'inadimplencia' ? (
          overdueCharges.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">Nenhuma cobrança em atraso.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {overdueCharges.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-5 py-3.5 bg-red-50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-red-800 truncate">{c.person_name_snapshot ?? '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.description} · Vence: {new Date(`${c.due_date}T00:00:00`).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <p className="text-sm font-bold text-red-600 flex-shrink-0">{fmt(Number(c.amount))}</p>
                </div>
              ))}
            </div>
          )
        ) : txList && txList.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Nenhum lançamento encontrado.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {(txList ?? []).map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{t.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(`${t.date}T00:00:00`).toLocaleDateString('pt-BR')}
                    {t.finance_categories?.name ? ` · ${t.finance_categories.name}` : ''}
                    {t.finance_funds?.name ? ` · ${t.finance_funds.name}` : ''}
                  </p>
                </div>
                <p className={`text-sm font-bold flex-shrink-0 ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {t.type === 'income' ? '+' : '−'}{fmt(Number(t.amount))}
                </p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}
