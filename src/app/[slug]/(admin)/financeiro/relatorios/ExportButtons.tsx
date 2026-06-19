'use client'

import { Download, Printer } from 'lucide-react'

type CategoryRow = { name: string; total: number }
type TxRow = { date: string; description: string; type: string; category: string; fund: string; amount: number }

type Props = {
  periodLabel: string
  totalReceita: number
  totalDespesa: number
  resultado: number
  receitaByCategory: CategoryRow[]
  despesaByCategory: CategoryRow[]
  transactions: TxRow[]
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob(['﻿' + content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCSV(props: Props) {
  const lines: string[] = []
  const sep = ';'

  lines.push(`Relatório Financeiro — ${props.periodLabel}`)
  lines.push('')
  lines.push(`Receitas${sep}${fmt(props.totalReceita)}`)
  lines.push(`Despesas${sep}${fmt(props.totalDespesa)}`)
  lines.push(`Resultado${sep}${fmt(props.resultado)}`)
  lines.push('')

  lines.push('RECEITAS POR CATEGORIA')
  lines.push(`Categoria${sep}Valor${sep}%`)
  for (const c of props.receitaByCategory) {
    const pct = props.totalReceita > 0 ? Math.round((c.total / props.totalReceita) * 100) : 0
    lines.push(`${c.name}${sep}${fmt(c.total)}${sep}${pct}%`)
  }
  lines.push('')

  lines.push('DESPESAS POR CATEGORIA')
  lines.push(`Categoria${sep}Valor${sep}%`)
  for (const c of props.despesaByCategory) {
    const pct = props.totalDespesa > 0 ? Math.round((c.total / props.totalDespesa) * 100) : 0
    lines.push(`${c.name}${sep}${fmt(c.total)}${sep}${pct}%`)
  }
  lines.push('')

  lines.push('TRANSAÇÕES')
  lines.push(`Data${sep}Descrição${sep}Tipo${sep}Categoria${sep}Fundo${sep}Valor`)
  for (const t of props.transactions) {
    const tipo = t.type === 'income' ? 'Receita' : 'Despesa'
    lines.push(`${fmtDate(t.date)}${sep}${t.description.replace(/;/g, ',')}${sep}${tipo}${sep}${t.category}${sep}${t.fund}${sep}${fmt(t.amount)}`)
  }

  downloadFile(lines.join('\n'), `relatorio-financeiro-${Date.now()}.csv`, 'text/csv')
}

function printReport() {
  window.print()
}

export function ExportButtons(props: Props) {
  return (
    <div className="flex gap-2 border-t border-gray-100 pt-2">
      <button
        type="button"
        onClick={() => exportCSV(props)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Download size={14} /> Exportar CSV
      </button>
      <button
        type="button"
        onClick={printReport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Printer size={14} /> Imprimir / PDF
      </button>
    </div>
  )
}
