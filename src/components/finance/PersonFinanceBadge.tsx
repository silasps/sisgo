import type { PersonFinanceSummary } from '@/lib/finance/personFinanceStatus'

function fmt(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PersonFinanceBadge({ summary, className = '' }: { summary: PersonFinanceSummary; className?: string }) {
  if (summary.overdueCount > 0) {
    return (
      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 ${className}`}>
        Em atraso: {fmt(summary.overdueAmount)}
      </span>
    )
  }
  if (summary.pendingCount > 0) {
    return (
      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 ${className}`}>
        {summary.pendingCount} cobrança{summary.pendingCount > 1 ? 's' : ''} pendente{summary.pendingCount > 1 ? 's' : ''}
      </span>
    )
  }
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 ${className}`}>
      Em dia
    </span>
  )
}
