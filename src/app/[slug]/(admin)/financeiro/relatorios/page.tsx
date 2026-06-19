import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { userHasAnyRole, GENERAL_FINANCE_ROLES } from '@/lib/auth/permissions'
import { ExportButtons } from './ExportButtons'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ year?: string; month?: string }> }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function RelatoriosPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { year: qYear, month: qMonth } = await searchParams
  const supabase = await createClient()
  const sbAdmin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id, role_accumulations').eq('slug', slug).single()
  if (!org) notFound()
  const orgId = org.id

  const { data: orgUser } = await supabase
    .from('organization_users').select('roles(name), extra_roles')
    .eq('user_id', user.id).eq('active', true).single()
  const role = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''
  const orgAccumulations = (org?.role_accumulations as Record<string, string[]> | null) ?? {}
  const extraRoles = (orgUser?.extra_roles as string[] | null) ?? []
  if (!userHasAnyRole([role, ...(orgAccumulations[role] ?? []), ...extraRoles], GENERAL_FINANCE_ROLES)) notFound()

  const today = new Date()
  const year = Number(qYear ?? today.getFullYear())
  const month = qMonth ? Number(qMonth) : null // null = ano inteiro

  const periodStart = month ? `${year}-${String(month).padStart(2, '0')}-01` : `${year}-01-01`
  const periodEnd = month
    ? new Date(year, month, 0).toISOString().slice(0, 10)
    : `${year}-12-31`

  // Busca transações do período
  const { data: txData } = await sbAdmin
    .from('financial_transactions')
    .select('id, description, amount, type, category, date, status, finance_categories(id, name), finance_funds(name)')
    .eq('organization_id', orgId)
    .gte('date', periodStart)
    .lte('date', periodEnd)
    .neq('status', 'cancelled')
    .order('date', { ascending: true })
    .limit(1000)

  // Busca últimos 6 meses para gráfico
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10)
  const { data: chartData } = await sbAdmin
    .from('financial_transactions')
    .select('amount, type, date')
    .eq('organization_id', orgId)
    .gte('date', sixMonthsAgo)
    .neq('status', 'cancelled')
    .limit(2000)

  type TxRow = { id: string; description: string; amount: number; type: string; category: string | null; date: string; finance_categories: { id: string; name: string } | null; finance_funds: { name: string } | null }
  const transactions = (txData ?? []) as unknown as TxRow[]

  // DRE
  const receitas = transactions.filter(t => t.type === 'income')
  const despesas = transactions.filter(t => t.type === 'expense')
  const totalReceita = receitas.reduce((s, t) => s + Number(t.amount), 0)
  const totalDespesa = despesas.reduce((s, t) => s + Number(t.amount), 0)
  const resultado = totalReceita - totalDespesa

  // Receita por categoria
  const receitaByCategory = groupByCategory(receitas)
  const despesaByCategory = groupByCategory(despesas)

  // Gráfico 6 meses
  const monthlyMap: Record<string, { income: number; expense: number; label: string }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = d.toISOString().slice(0, 7)
    monthlyMap[key] = {
      income: 0, expense: 0,
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    }
  }
  for (const t of (chartData ?? [])) {
    const key = (t.date as string).slice(0, 7)
    if (monthlyMap[key]) {
      if (t.type === 'income') monthlyMap[key].income += Number(t.amount)
      else monthlyMap[key].expense += Number(t.amount)
    }
  }
  const chartMonths = Object.values(monthlyMap)
  const chartMax = Math.max(...chartMonths.map(m => Math.max(m.income, m.expense)), 1)

  // Seletores
  const years = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]
  const months = [
    { v: '', l: 'Ano inteiro' },
    ...Array.from({ length: 12 }, (_, i) => ({
      v: String(i + 1),
      l: new Date(2000, i, 1).toLocaleDateString('pt-BR', { month: 'long' }),
    })),
  ]

  return (
    <>
      <Header
        title="Relatórios"
        actions={
          <Link href={`/${slug}/financeiro`} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            ← Financeiro
          </Link>
        }
      />
      <main className="p-4 md:p-6 space-y-6 max-w-4xl">

        {/* Filtro de período */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
          <form method="get" action={`/${slug}/financeiro/relatorios`} className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-gray-600">Período:</span>
            <select name="year" defaultValue={year} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-400">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select name="month" defaultValue={String(qMonth ?? '')} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-400">
              {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <button type="submit" className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
              Atualizar
            </button>
            <span className="ml-auto text-xs text-gray-400">
              {new Date(`${periodStart}T00:00:00`).toLocaleDateString('pt-BR')} → {new Date(`${periodEnd}T00:00:00`).toLocaleDateString('pt-BR')}
            </span>
          </form>
          <ExportButtons
            periodLabel={`${new Date(`${periodStart}T00:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${periodEnd}T00:00:00`).toLocaleDateString('pt-BR')}`}
            totalReceita={totalReceita}
            totalDespesa={totalDespesa}
            resultado={resultado}
            receitaByCategory={receitaByCategory}
            despesaByCategory={despesaByCategory}
            transactions={transactions.map(t => ({
              date: t.date,
              description: t.description,
              type: t.type,
              category: t.finance_categories?.name ?? t.category ?? 'Sem categoria',
              fund: t.finance_funds?.name ?? '',
              amount: Number(t.amount),
            }))}
          />
        </div>

        {/* Resultado resumo */}
        <section className="grid grid-cols-3 gap-3 animate-stagger">
          <div className="bg-green-50 rounded-xl border border-gray-200 p-4">
            <p className="text-xl font-bold text-green-600">{fmt(totalReceita)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total de receitas</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-gray-200 p-4">
            <p className="text-xl font-bold text-red-600">{fmt(totalDespesa)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total de despesas</p>
          </div>
          <div className={`rounded-xl border border-gray-200 p-4 ${resultado >= 0 ? 'bg-brand-50' : 'bg-orange-50'}`}>
            <p className={`text-xl font-bold ${resultado >= 0 ? 'text-brand-600' : 'text-orange-600'}`}>{fmt(resultado)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Resultado ({resultado >= 0 ? 'superávit' : 'déficit'})</p>
          </div>
        </section>

        {/* Gráfico de barras — últimos 6 meses */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Fluxo de caixa — últimos 6 meses</h2>
          <div className="flex items-end gap-3 h-40">
            {chartMonths.map(m => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 h-32">
                  <div
                    className="flex-1 bg-green-400 rounded-t-sm transition-all"
                    style={{ height: `${Math.round((m.income / chartMax) * 100)}%`, minHeight: m.income > 0 ? '3px' : '0' }}
                    title={`Receita: ${fmt(m.income)}`}
                  />
                  <div
                    className="flex-1 bg-red-400 rounded-t-sm transition-all"
                    style={{ height: `${Math.round((m.expense / chartMax) * 100)}%`, minHeight: m.expense > 0 ? '3px' : '0' }}
                    title={`Despesa: ${fmt(m.expense)}`}
                  />
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-400" /><span className="text-xs text-gray-500">Receita</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-400" /><span className="text-xs text-gray-500">Despesa</span></div>
          </div>
        </section>

        {/* DRE por categoria */}
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Receitas por categoria</h2>
              <span className="text-sm font-bold text-green-600">{fmt(totalReceita)}</span>
            </div>
            {receitaByCategory.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">Nenhuma receita no período.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {receitaByCategory.map(c => (
                  <div key={c.name} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 truncate">{c.name}</span>
                        <span className="text-sm font-semibold text-green-600 ml-2 flex-shrink-0">{fmt(c.total)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: `${totalReceita > 0 ? Math.round((c.total / totalReceita) * 100) : 0}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 w-8 text-right">
                      {totalReceita > 0 ? `${Math.round((c.total / totalReceita) * 100)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Despesas por categoria</h2>
              <span className="text-sm font-bold text-red-600">{fmt(totalDespesa)}</span>
            </div>
            {despesaByCategory.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">Nenhuma despesa no período.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {despesaByCategory.map(c => (
                  <div key={c.name} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 truncate">{c.name}</span>
                        <span className="text-sm font-semibold text-red-500 ml-2 flex-shrink-0">{fmt(c.total)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${totalDespesa > 0 ? Math.round((c.total / totalDespesa) * 100) : 0}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 w-8 text-right">
                      {totalDespesa > 0 ? `${Math.round((c.total / totalDespesa) * 100)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Resultado final */}
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">DRE Simplificado</h2>
          </div>
          <div className="p-4 space-y-2">
            <DRELine label="(+) Receitas totais" value={totalReceita} cls="text-green-600" />
            <DRELine label="(−) Despesas totais" value={totalDespesa} cls="text-red-500" />
            <div className="border-t border-gray-200 pt-2 mt-2">
              <DRELine label="(=) Resultado do período" value={resultado} cls={resultado >= 0 ? 'text-brand-600 font-bold' : 'text-orange-600 font-bold'} bold />
            </div>
            {transactions.length === 0 && (
              <p className="text-xs text-gray-400 pt-2">Nenhuma transação registrada no período.</p>
            )}
            <p className="text-xs text-gray-400 pt-1">{transactions.length} transação(ões) considerada(s). Canceladas e lançamentos de áreas não incluídos.</p>
          </div>
        </section>
      </main>
    </>
  )
}

function DRELine({ label, value, cls, bold }: { label: string; value: number; cls: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'text-base' : 'text-sm'}`}>
      <span className="text-gray-700">{label}</span>
      <span className={cls}>{fmt(value)}</span>
    </div>
  )
}

function groupByCategory(txs: Array<{ amount: number; category: string | null; finance_categories: { name: string } | null }>) {
  const map: Record<string, number> = {}
  for (const t of txs) {
    const name = t.finance_categories?.name ?? t.category ?? 'Sem categoria'
    map[name] = (map[name] ?? 0) + Number(t.amount)
  }
  return Object.entries(map)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
}
