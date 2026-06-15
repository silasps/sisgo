import { FinanceiroKpiCards } from './FinanceiroKpiCards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { InputHTMLAttributes } from 'react'
import { getRolePreview } from '@/lib/role-preview'
import { asLooseClient } from '@/lib/supabase/loose-client'
import { isGeneralFinanceRole, userHasAnyRole, GENERAL_FINANCE_ROLES } from '@/lib/auth/permissions'

type Props = { params: Promise<{ slug: string }> }

type TransactionRow = {
  id: string; description: string; amount: number; type: 'income' | 'expense'
  category: string | null; date: string; status: string
  payment_method: string | null; reference_code: string | null
  finance_funds: { id: string; name: string; restriction_type: string } | null
  finance_categories: { id: string; name: string } | null
  ministries: { id: string; name: string } | null
  schools: { id: string; name: string } | null
}
type FundRow = { id: string; name: string; description: string | null; restriction_type: string; active: boolean }
type CategoryRow = { id: string; name: string; type: 'income' | 'expense' | 'both' }
type BudgetRow = {
  id: string; name: string; planned_amount: number; period_start: string; period_end: string
  fund_id: string | null; category_id: string | null; ministry_id: string | null; school_id: string | null
  finance_funds: { name: string } | null; finance_categories: { name: string } | null
  ministries: { name: string } | null; schools: { name: string } | null
}
type CashScopeRow = {
  id: string; entity_type: 'school' | 'ministry'; school_id: string | null; ministry_id: string | null
  name_snapshot: string | null; schools: { name: string; school_type: string | null } | null; ministries: { name: string } | null
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function FinanceiroPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const sbAdmin = createAdminClient()
  const looseAdmin = asLooseClient(sbAdmin)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id, role_accumulations').eq('slug', slug).single()
  const orgId = org?.id ?? ''
  if (!orgId) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users').select('organization_id, roles(name), extra_roles')
    .eq('user_id', user.id).eq('active', true)
  const userOrgRows = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null; extra_roles?: string[] | null }>
  const superadminRow = userOrgRows.find(r => r.roles?.name === 'superadmin')
  const currentOrgRow = userOrgRows.find(r => r.organization_id === orgId)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  const preview = await getRolePreview(realRole)
  const role = preview?.role ?? realRole
  const orgAccumulations = (org?.role_accumulations as Record<string, string[]> | null) ?? {}
  const accumulatedRoles = orgAccumulations[role] ?? []
  const extraRoles = (currentOrgRow?.extra_roles as string[] | null) ?? []
  if (!userHasAnyRole([role, ...accumulatedRoles, ...extraRoles], GENERAL_FINANCE_ROLES)) notFound()
  if (realRole !== 'superadmin' && !currentOrgRow) redirect('/login')

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10)
  const in7days = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)

  const [
    { data: lancamentos },
    { data: funds },
    { data: categories },
    { data: budgets },
    { data: ministries },
    { data: schools },
    { count: pendingRequestsCount },
    { data: cashScopes },
    { data: areaTransactions },
    { data: chargesSummary },
    { data: payablesSummary },
    { data: chartTx },
  ] = await Promise.all([
    sbAdmin
      .from('financial_transactions')
      .select('id, description, amount, type, category, date, status, payment_method, reference_code, finance_funds(id, name, restriction_type), finance_categories(id, name), ministries(id, name), schools(id, name)')
      .eq('organization_id', orgId)
      .is('cash_scope_id', null)
      .order('date', { ascending: false })
      .limit(50),
    sbAdmin.from('finance_funds').select('id, name, description, restriction_type, active').eq('organization_id', orgId).eq('active', true).order('name'),
    sbAdmin.from('finance_categories').select('id, name, type').eq('organization_id', orgId).eq('active', true).order('name'),
    sbAdmin
      .from('finance_budgets')
      .select('id, name, planned_amount, period_start, period_end, fund_id, category_id, ministry_id, school_id, finance_funds(name), finance_categories(name), ministries(name), schools(name)')
      .eq('organization_id', orgId).eq('active', true).order('period_start', { ascending: false }).limit(10),
    sbAdmin.from('ministries').select('id, name').eq('organization_id', orgId).eq('active', true).order('name'),
    sbAdmin.from('schools').select('id, name').eq('organization_id', orgId).eq('active', true).order('name'),
    sbAdmin.from('finance_expense_requests').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pending'),
    looseAdmin.from('finance_cash_scopes').select('id, entity_type, school_id, ministry_id, name_snapshot, schools(name, school_type), ministries(name)').eq('organization_id', orgId).eq('enabled', true),
    looseAdmin.from('financial_transactions').select('id, cash_scope_id, amount, type').eq('organization_id', orgId).not('cash_scope_id', 'is', null),
    looseAdmin.from('finance_charges').select('id, amount, status, due_date').eq('organization_id', orgId).in('status', ['pending', 'overdue']),
    looseAdmin.from('finance_payables').select('id, amount, status, due_date').eq('organization_id', orgId).eq('status', 'pending'),
    sbAdmin.from('financial_transactions').select('amount, type, date').eq('organization_id', orgId).gte('date', sixMonthsAgo).neq('status', 'cancelled').limit(2000),
  ])

  const transactions = (lancamentos ?? []) as unknown as TransactionRow[]
  const fundRows = (funds ?? []) as FundRow[]
  const categoryRows = (categories ?? []) as CategoryRow[]
  const budgetRows = (budgets ?? []) as unknown as BudgetRow[]
  const ministryRows = (ministries ?? []) as Array<{ id: string; name: string }>
  const schoolRows = (schools ?? []) as Array<{ id: string; name: string }>
  const cashScopeRows = (cashScopes ?? []) as unknown as CashScopeRow[]
  const areaTransactionRows = (areaTransactions ?? []) as Array<{ cash_scope_id: string | null; amount: number; type: string }>
  const chargeRows = (chargesSummary ?? []) as Array<{ id: string; amount: number; status: string; due_date: string }>
  const payableRows = (payablesSummary ?? []) as Array<{ id: string; amount: number; status: string; due_date: string }>

  // KPIs do mês
  const monthTx = transactions.filter(t => t.date >= monthStart && t.date <= monthEnd)
  const receitasMes = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const despesasMes = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const saldoMes = receitasMes - despesasMes
  const receitas = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const despesas = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const restrictedBalance = transactions
    .filter(t => t.finance_funds?.restriction_type === 'restricted')
    .reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0)

  const fundBalances = fundRows.map(fund => ({
    ...fund,
    balance: transactions.filter(t => t.finance_funds?.id === fund.id)
      .reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0),
  }))

  const budgetUsage = budgetRows.map(budget => {
    const spent = transactions.filter(t => t.type === 'expense'
      && (!budget.fund_id || t.finance_funds?.id === budget.fund_id)
      && (!budget.category_id || t.finance_categories?.id === budget.category_id)
      && (!budget.ministry_id || t.ministries?.id === budget.ministry_id)
      && (!budget.school_id || t.schools?.id === budget.school_id)
      && t.date >= budget.period_start && t.date <= budget.period_end
    ).reduce((s, t) => s + Number(t.amount), 0)
    const planned = Number(budget.planned_amount ?? 0)
    return { ...budget, spent, remaining: planned - spent, percent: planned > 0 ? Math.min(100, Math.round((spent / planned) * 100)) : 0 }
  })

  const cashScopeBalances = cashScopeRows.map(scope => ({
    ...scope,
    balance: areaTransactionRows.filter(t => t.cash_scope_id === scope.id)
      .reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0),
  }))

  // Cobranças / contas a pagar
  const totalChargesOverdue = chargeRows.filter(c => c.status === 'overdue' || (c.status === 'pending' && c.due_date < todayStr)).reduce((s, c) => s + Number(c.amount), 0)
  const totalChargesPending = chargeRows.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)
  const totalPayablesOverdue = payableRows.filter(p => p.due_date < todayStr).reduce((s, p) => s + Number(p.amount), 0)
  const totalPayablesDueSoon = payableRows.filter(p => p.due_date <= in7days).reduce((s, p) => s + Number(p.amount), 0)
  const inadimplencia = totalChargesOverdue

  // Gráfico 6 meses
  const monthlyChart: Record<string, { income: number; expense: number; label: string }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = d.toISOString().slice(0, 7)
    monthlyChart[key] = { income: 0, expense: 0, label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) }
  }
  for (const t of (chartTx ?? []) as Array<{ amount: number; type: string; date: string }>) {
    const key = t.date.slice(0, 7)
    if (monthlyChart[key]) {
      if (t.type === 'income') monthlyChart[key].income += Number(t.amount)
      else monthlyChart[key].expense += Number(t.amount)
    }
  }
  const chartMonths = Object.values(monthlyChart)
  const chartMax = Math.max(...chartMonths.map(m => Math.max(m.income, m.expense)), 1)

  // Server actions
  const handleCreateTransaction = async (formData: FormData) => {
    'use server'
    const type = String(formData.get('type') ?? '') === 'expense' ? 'expense' : 'income'
    const categoryId = String(formData.get('category_id') ?? '') || null
    const categoryName = categoryId
      ? ((await createAdminClient().from('finance_categories').select('name').eq('id', categoryId).maybeSingle()).data?.name ?? null)
      : null
    await createAdminClient().from('financial_transactions').insert({
      organization_id: orgId,
      description: String(formData.get('description') ?? '').trim(),
      amount: Number(formData.get('amount') ?? 0),
      type, category: categoryName, category_id: categoryId,
      fund_id: String(formData.get('fund_id') ?? '') || null,
      ministry_id: String(formData.get('ministry_id') ?? '') || null,
      school_id: String(formData.get('school_id') ?? '') || null,
      payment_method: String(formData.get('payment_method') ?? '').trim() || null,
      reference_code: String(formData.get('reference_code') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
      date: String(formData.get('date') ?? '') || todayStr,
      status: String(formData.get('status') ?? 'paid'),
      created_by: user?.id ?? null,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
    })
    redirect(`/${slug}/financeiro`)
  }

  const handleCreateBudget = async (formData: FormData) => {
    'use server'
    await createAdminClient().from('finance_budgets').insert({
      organization_id: orgId,
      name: String(formData.get('name') ?? '').trim(),
      planned_amount: Number(formData.get('planned_amount') ?? 0),
      period_start: String(formData.get('period_start') ?? '') || monthStart,
      period_end: String(formData.get('period_end') ?? '') || monthEnd,
      fund_id: String(formData.get('fund_id') ?? '') || null,
      category_id: String(formData.get('category_id') ?? '') || null,
      ministry_id: String(formData.get('ministry_id') ?? '') || null,
      school_id: String(formData.get('school_id') ?? '') || null,
      created_by: user?.id ?? null,
    })
    redirect(`/${slug}/financeiro`)
  }

  const handleCreateFund = async (formData: FormData) => {
    'use server'
    await createAdminClient().from('finance_funds').insert({
      organization_id: orgId,
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim() || null,
      restriction_type: String(formData.get('restriction_type') ?? 'unrestricted'),
      created_by: user?.id ?? null,
    })
    redirect(`/${slug}/financeiro`)
  }

  return (
    <>
      <Header title="Financeiro" />
      <main className="p-4 md:p-6 space-y-5">

        {/* ── KPIs do mês ─────────────────────────────────────────── */}
        <FinanceiroKpiCards
          receitasMes={receitasMes} despesasMes={despesasMes} saldoMes={saldoMes} inadimplencia={inadimplencia}
          monthIncome={monthTx.filter(t => t.type === 'income') as Parameters<typeof FinanceiroKpiCards>[0]['monthIncome']}
          monthExpense={monthTx.filter(t => t.type === 'expense') as Parameters<typeof FinanceiroKpiCards>[0]['monthExpense']}
          overdueCharges={(chargeRows.filter(c => c.status === 'overdue' || (c.status === 'pending' && c.due_date < todayStr)) as unknown) as Parameters<typeof FinanceiroKpiCards>[0]['overdueCharges']}
        />

        {/* ── Módulos ──────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: `/${slug}/financeiro/tabela-valores`, icon: '📋', title: 'Tabela de Valores', desc: 'Preços por semestre', alert: false },
            { href: `/${slug}/financeiro/cobrancas`, icon: '🧾', title: 'Cobranças', desc: totalChargesOverdue > 0 ? `${fmt(totalChargesOverdue)} em atraso` : `${fmt(totalChargesPending)} pendente`, alert: totalChargesOverdue > 0 },
            { href: `/${slug}/financeiro/contas-pagar`, icon: '📅', title: 'Contas a Pagar', desc: totalPayablesOverdue > 0 ? `${fmt(totalPayablesOverdue)} vencido` : `${fmt(totalPayablesDueSoon)} em 7 dias`, alert: totalPayablesOverdue > 0 },
            { href: `/${slug}/financeiro/relatorios`, icon: '📊', title: 'Relatórios', desc: 'DRE e fluxo de caixa', alert: false },
          ].map(m => (
            <Link key={m.href} href={m.href}
              className={`group relative rounded-xl border bg-white p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${m.alert ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
              <p className="text-2xl mb-2">{m.icon}</p>
              <p className={`text-sm font-semibold group-hover:text-brand-600 transition-colors ${m.alert ? 'text-red-700' : 'text-gray-900'}`}>{m.title}</p>
              <p className={`text-xs mt-0.5 ${m.alert ? 'text-red-600 font-medium' : 'text-gray-400'}`}>{m.desc}</p>
              <span className="absolute top-3 right-3 text-xs text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </Link>
          ))}
        </section>

        {/* ── Gráfico + Lançamento rápido ──────────────────────────── */}
        <section className="grid gap-5 xl:grid-cols-[1fr_340px]">

          {/* Gráfico */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-800">Fluxo de caixa — últimos 6 meses</h2>
              <div className="flex gap-3">
                <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" />Receita</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />Despesa</span>
              </div>
            </div>
            <div className="flex items-end gap-2 h-36">
              {chartMonths.map(m => (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end gap-0.5 h-28">
                    <div className="flex-1 bg-green-400 rounded-t" style={{ height: `${Math.round((m.income / chartMax) * 100)}%`, minHeight: m.income > 0 ? '3px' : '0' }} title={fmt(m.income)} />
                    <div className="flex-1 bg-red-400 rounded-t" style={{ height: `${Math.round((m.expense / chartMax) * 100)}%`, minHeight: m.expense > 0 ? '3px' : '0' }} title={fmt(m.expense)} />
                  </div>
                  <span className="text-xs text-gray-400">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lançamento rápido */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-800">Novo lançamento</h2>
            </div>
            <form action={handleCreateTransaction} className="space-y-2.5 p-4">
              <Field name="description" label="Descrição" required placeholder="Ex: Oferta, conta de água..." />
              <div className="grid grid-cols-2 gap-2">
                <Select name="type" label="Tipo" options={[['income', '+ Receita'], ['expense', '− Despesa']]} />
                <Field name="amount" label="Valor" type="number" step="0.01" min="0" required placeholder="0,00" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select name="fund_id" label="Fundo" options={[['', 'Sem fundo'], ...fundRows.map(f => [f.id, f.name] as [string, string])]} />
                <Select name="category_id" label="Categoria" options={[['', 'Sem categoria'], ...categoryRows.map(c => [c.id, c.name] as [string, string])]} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field name="date" label="Data" type="date" defaultValue={todayStr} />
                <Select name="status" label="Status" options={[['paid', 'Pago'], ['pending', 'Pendente']]} />
              </div>
              <Field name="payment_method" label="Método / referência" placeholder="Pix, NF, comprovante..." />
              <button className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors">
                Registrar
              </button>
            </form>
          </div>
        </section>

        {/* ── Orçamentos + Fundos ──────────────────────────────────── */}
        <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">

          {/* Orçamentos */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Orçamentos</h2>
                <p className="text-xs text-gray-400">Gasto real vs. planejado por área/projeto</p>
              </div>
              {(pendingRequestsCount ?? 0) > 0 && (
                <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {pendingRequestsCount} pendente{(pendingRequestsCount ?? 0) > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Criar orçamento */}
            <details className="border-b border-gray-100">
              <summary className="px-4 py-2.5 text-xs font-medium text-brand-600 hover:bg-brand-50 cursor-pointer transition-colors list-none">
                + Novo orçamento
              </summary>
              <form action={handleCreateBudget} className="grid gap-2 bg-gray-50 px-4 pb-4 pt-2 sm:grid-cols-2">
                <Field name="name" label="Nome" required placeholder="Ex: Cozinha - Julho" className="sm:col-span-2" />
                <Field name="planned_amount" label="Valor planejado" type="number" step="0.01" min="0" required />
                <div className="grid grid-cols-2 gap-2 sm:col-span-1">
                  <Field name="period_start" label="Início" type="date" defaultValue={monthStart} />
                  <Field name="period_end" label="Fim" type="date" defaultValue={monthEnd} />
                </div>
                <Select name="fund_id" label="Fundo" options={[['', 'Todos'], ...fundRows.map(f => [f.id, f.name] as [string, string])]} />
                <Select name="category_id" label="Categoria" options={[['', 'Todas'], ...categoryRows.map(c => [c.id, c.name] as [string, string])]} />
                <Select name="ministry_id" label="Ministério" options={[['', 'Todos'], ...ministryRows.map(m => [m.id, m.name] as [string, string])]} />
                <Select name="school_id" label="Escola" options={[['', 'Todas'], ...schoolRows.map(s => [s.id, s.name] as [string, string])]} />
                <button className="sm:col-span-2 rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors">
                  Criar orçamento
                </button>
              </form>
            </details>

            {budgetUsage.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">Nenhum orçamento cadastrado.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {budgetUsage.map(b => (
                  <div key={b.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {[b.finance_funds?.name, b.finance_categories?.name, b.ministries?.name, b.schools?.name].filter(Boolean).join(' · ') || 'Geral'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-gray-900">{fmt(b.spent)}<span className="text-gray-400 font-normal"> / {fmt(Number(b.planned_amount))}</span></p>
                        <p className={`text-xs ${b.remaining >= 0 ? 'text-gray-400' : 'text-red-600 font-medium'}`}>
                          {b.remaining >= 0 ? `Restam ${fmt(b.remaining)}` : `Excedido ${fmt(Math.abs(b.remaining))}`}
                        </p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${b.percent >= 90 ? 'bg-red-500' : b.percent >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${b.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fundos */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-800">Fundos e saldos</h2>
              <p className="text-xs text-gray-400">Saldo acumulado de todas as transações vinculadas a cada fundo</p>
            </div>

            {/* Criar fundo */}
            <details className="border-b border-gray-100">
              <summary className="px-4 py-2.5 text-xs font-medium text-brand-600 hover:bg-brand-50 cursor-pointer transition-colors list-none">
                + Novo fundo
              </summary>
              <form action={handleCreateFund} className="space-y-2 bg-gray-50 px-4 pb-4 pt-2">
                <Field name="name" label="Nome" required placeholder="Ex: Reforma alojamento" />
                <Select name="restriction_type" label="Tipo" options={[['unrestricted', 'Livre'], ['designated', 'Designado'], ['restricted', 'Restrito por doador']]} />
                <Field name="description" label="Finalidade" placeholder="Opcional" />
                <button className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors">Criar fundo</button>
              </form>
            </details>

            {fundBalances.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">Nenhum fundo criado.</p>
            ) : (
              <div className="grid gap-px bg-gray-100">
                {fundBalances.map(fund => (
                  <div key={fund.id} className="bg-white px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{fund.name}</p>
                      <p className="text-xs text-gray-400">{fund.description ?? restrictionLabel(fund.restriction_type)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${restrictionClass(fund.restriction_type)}`}>{restrictionLabel(fund.restriction_type)}</span>
                      <p className={`text-sm font-bold ${fund.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(fund.balance)}</p>
                    </div>
                  </div>
                ))}
                <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Fundos restritos</span>
                  <span className="text-sm font-bold text-blue-600">{fmt(restrictedBalance)}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Caixas das áreas ─────────────────────────────────────── */}
        {cashScopeBalances.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-800">Caixas próprios das áreas</h2>
              <p className="text-xs text-gray-400">Não entram no saldo operacional da base</p>
            </div>
            <div className="grid gap-px bg-gray-100 sm:grid-cols-2 xl:grid-cols-3">
              {cashScopeBalances.map(scope => (
                <div key={scope.id} className="bg-white px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{scope.schools?.name ?? scope.ministries?.name ?? scope.name_snapshot ?? 'Área'}</p>
                    <p className="text-xs text-gray-400">{scope.entity_type === 'school' ? 'Escola' : 'Ministério'}</p>
                  </div>
                  <p className={`text-sm font-bold flex-shrink-0 ${scope.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(scope.balance)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Lançamentos recentes ────────────────────────────────── */}
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Lançamentos recentes</h2>
            <Link href={`/${slug}/financeiro/relatorios`} className="text-xs text-brand-500 hover:text-brand-600 font-medium transition-colors">
              Ver relatório →
            </Link>
          </div>
          {transactions.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-400">Nenhum lançamento registrado ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Descrição</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Fundo / categoria</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.description}</p>
                      {(t.payment_method || t.reference_code) && (
                        <p className="mt-0.5 text-xs text-gray-400">{[t.payment_method, t.reference_code].filter(Boolean).join(' · ')}</p>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-500">
                      <p>{t.finance_funds?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{t.finance_categories?.name ?? t.category ?? '—'}</p>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-500">
                      {t.date ? new Date(`${t.date}T00:00:00`).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className={`px-4 py-3 text-right font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                      {t.type === 'income' ? '+' : '−'}{fmt(Number(t.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  )
}

// ── Componentes ────────────────────────────────────────────────────────

const colorMap = {
  green:  { bg: 'bg-green-50',  val: 'text-green-600',  border: 'border-green-100' },
  red:    { bg: 'bg-red-50',    val: 'text-red-600',    border: 'border-red-100' },
  brand:  { bg: 'bg-brand-50',  val: 'text-brand-600',  border: 'border-brand-100' },
  orange: { bg: 'bg-orange-50', val: 'text-orange-600', border: 'border-orange-100' },
  gray:   { bg: 'bg-white',     val: 'text-gray-900',   border: 'border-gray-200' },
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: keyof typeof colorMap }) {
  const c = colorMap[color]
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4`}>
      <p className={`text-xl font-bold ${c.val}`}>{value}</p>
      <p className="text-xs font-medium text-gray-700 mt-1">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid:      { label: 'Pago',      cls: 'bg-green-100 text-green-700' },
    pending:   { label: 'Pendente',  cls: 'bg-yellow-100 text-yellow-700' },
    overdue:   { label: 'Atrasado',  cls: 'bg-red-100 text-red-600' },
    cancelled: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
  }
  const s = map[status ?? ''] ?? { label: status ?? '—', cls: 'bg-gray-100 text-gray-500' }
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
}

function Field({ label, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input {...props} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
    </label>
  )
}

function Select({ label, name, options }: { label: string; name: string; options: Array<[string, string]> }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <select name={name} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
        {options.map(([v, l]) => <option key={`${name}-${v}`} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

function restrictionLabel(type: string) {
  return ({ unrestricted: 'Livre', designated: 'Designado', restricted: 'Restrito' })[type] ?? type
}

function restrictionClass(type: string) {
  return ({ unrestricted: 'bg-green-100 text-green-700', designated: 'bg-blue-100 text-blue-700', restricted: 'bg-purple-100 text-purple-700' })[type] ?? 'bg-gray-100 text-gray-600'
}
