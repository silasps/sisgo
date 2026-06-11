'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

type StockItem = {
  id: string; name: string; category: string | null; unit: string
  quantity: number; min_quantity: number; critical: boolean; default_location: string | null
}
type ExpiringLot = {
  id: string; item_id: string; expiration_date: string | null
  quantity_current: number; location: string | null; supplier_name: string | null; item_name: string
}
type KpiType = 'all' | 'low' | 'critical' | 'expiring'

const kpiColors = {
  gray:   { bg: 'bg-white',     val: 'text-gray-900',   border: 'border-gray-200' },
  yellow: { bg: 'bg-yellow-50', val: 'text-yellow-700', border: 'border-yellow-100' },
  red:    { bg: 'bg-red-50',    val: 'text-red-600',    border: 'border-red-100' },
}

function fmtDate(d: string | null) {
  return d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR') : '—'
}

export function StockKpiCards({ items, expiringLots, lowStockTotal, criticalLowTotal }: {
  items: StockItem[]; expiringLots: ExpiringLot[]; lowStockTotal: number; criticalLowTotal: number
}) {
  const [open, setOpen] = useState<KpiType | null>(null)

  const kpis: Array<{ type: KpiType; value: number; label: string; color: keyof typeof kpiColors }> = [
    { type: 'all',      value: items.length,       label: 'Itens ativos',         color: 'gray' },
    { type: 'low',      value: lowStockTotal,       label: 'Estoque baixo',        color: lowStockTotal > 0 ? 'yellow' : 'gray' },
    { type: 'critical', value: criticalLowTotal,    label: 'Críticos em falta',    color: criticalLowTotal > 0 ? 'red' : 'gray' },
    { type: 'expiring', value: expiringLots.length, label: 'Lotes vencendo (30d)', color: expiringLots.length > 0 ? 'yellow' : 'gray' },
  ]

  const modalTitle: Record<KpiType, string> = {
    all: 'Todos os itens ativos', low: 'Estoque baixo', critical: 'Críticos em falta', expiring: 'Lotes vencendo em 30 dias',
  }

  const modalItems = open === 'all' ? items
    : open === 'low' ? items.filter(i => i.quantity <= i.min_quantity)
    : open === 'critical' ? items.filter(i => i.critical && i.quantity <= i.min_quantity)
    : []

  return (
    <>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => {
          const c = kpiColors[k.color]
          return (
            <button key={k.type} onClick={() => setOpen(k.type)}
              className={`${c.bg} border ${c.border} rounded-xl p-4 text-left cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 w-full`}>
              <p className={`text-2xl font-bold ${c.val}`}>{k.value.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">{k.label}</p>
              <p className="text-xs text-brand-400 mt-1">Ver detalhes →</p>
            </button>
          )
        })}
      </section>

      <Modal open={open !== null} onClose={() => setOpen(null)}
        title={open ? modalTitle[open] : ''}
        subtitle={open === 'expiring'
          ? `${expiringLots.length} lote${expiringLots.length !== 1 ? 's' : ''}`
          : `${modalItems.length} item${modalItems.length !== 1 ? 's' : ''}`}>

        {open === 'expiring' ? (
          expiringLots.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">Nenhum lote vencendo nos próximos 30 dias.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {expiringLots.map(lot => {
                const daysLeft = lot.expiration_date
                  ? Math.ceil((new Date(`${lot.expiration_date}T00:00:00`).getTime() - Date.now()) / 86400000)
                  : null
                const urgent = daysLeft !== null && daysLeft <= 7
                return (
                  <div key={lot.id} className={`flex items-center justify-between gap-3 px-5 py-3.5 ${urgent ? 'bg-red-50' : ''}`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${urgent ? 'text-red-800' : 'text-gray-900'}`}>{lot.item_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Vence: {fmtDate(lot.expiration_date)}
                        {daysLeft !== null && <span className={`ml-1.5 font-medium ${urgent ? 'text-red-500' : 'text-yellow-600'}`}>({daysLeft <= 0 ? 'vencido' : `${daysLeft}d`})</span>}
                        {lot.supplier_name ? ` · ${lot.supplier_name}` : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-sm font-bold ${urgent ? 'text-red-600' : 'text-gray-900'}`}>{Number(lot.quantity_current).toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-gray-400">restantes</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : modalItems.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Nenhum item nesta categoria.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {modalItems.map(item => {
              const isCriticalLow = item.critical && item.quantity <= item.min_quantity
              const isLow = !item.critical && item.min_quantity > 0 && item.quantity <= item.min_quantity
              const pct = item.min_quantity > 0 ? Math.min(100, Math.round((item.quantity / item.min_quantity) * 100)) : 100
              return (
                <div key={item.id} className={`flex items-center justify-between gap-3 px-5 py-3.5 ${isCriticalLow ? 'bg-red-50' : isLow ? 'bg-yellow-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-sm font-semibold ${isCriticalLow ? 'text-red-800' : 'text-gray-900'}`}>{item.name}</p>
                      {item.critical && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">Crítico</span>}
                      {item.category && <span className="text-xs text-gray-400">{item.category}</span>}
                    </div>
                    {item.min_quantity > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isCriticalLow ? 'bg-red-500' : isLow ? 'bg-yellow-400' : 'bg-green-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">mín {item.min_quantity.toLocaleString('pt-BR')} {item.unit}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-lg font-bold ${isCriticalLow ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-gray-900'}`}>{item.quantity.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-gray-400">{item.unit}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </>
  )
}
