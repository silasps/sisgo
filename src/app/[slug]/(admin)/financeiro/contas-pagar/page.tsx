import { ContasPagarKpiCards } from './ContasPagarKpiCards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { userHasAnyRole, GENERAL_FINANCE_ROLES } from '@/lib/auth/permissions'

type Props = { params: Promise<{ slug: string }> }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pendente',  cls: 'bg-yellow-100 text-yellow-700' },
  paid:      { label: 'Pago',      cls: 'bg-green-100 text-green-700' },
  overdue:   { label: 'Atrasado',  cls: 'bg-red-100 text-red-600' },
  cancelled: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
}

const RECURRENCE_MAP: Record<string, string> = {
  once:    'Único',
  monthly: 'Mensal',
  annual:  'Anual',
}

export default async function ContasPagarPage({ params }: Props) {
  const { slug } = await params
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
  const todayStr = today.toISOString().slice(0, 10)
  const in7days = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [{ data: payablesData }, { data: categories }, { data: funds }] = await Promise.all([
    sbAdmin.from('finance_payables')
      .select('*, finance_categories(name), finance_funds(name)')
      .eq('organization_id', orgId)
      .order('due_date', { ascending: true })
      .limit(200),
    sbAdmin.from('finance_categories').select('id, name').eq('organization_id', orgId).eq('active', true).order('name'),
    sbAdmin.from('finance_funds').select('id, name').eq('organization_id', orgId).eq('active', true).order('name'),
  ])

  type PayableRow = {
    id: string; description: string; supplier: string | null; amount: number; due_date: string
    recurrence: string; status: string; notes: string | null
    finance_categories: { name: string } | null
    finance_funds: { name: string } | null
  }
  const payables = (payablesData ?? []) as unknown as PayableRow[]
  const categoryRows = (categories ?? []) as Array<{ id: string; name: string }>
  const fundRows = (funds ?? []) as Array<{ id: string; name: string }>

  // Alertas
  const overdueItems = payables.filter(p => p.status === 'pending' && p.due_date < todayStr)
  const dueSoon = payables.filter(p => p.status === 'pending' && p.due_date >= todayStr && p.due_date <= in7days)
  const dueThisMonth = payables.filter(p => p.status === 'pending' && p.due_date >= monthStart && p.due_date <= monthEnd)

  const totalOverdue = overdueItems.reduce((s, p) => s + Number(p.amount), 0)
  const totalMonth = dueThisMonth.reduce((s, p) => s + Number(p.amount), 0)
  const totalPaid = payables.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)

  const handleCreate = async (formData: FormData) => {
    'use server'
    const sb = createAdminClient()
    const recurrence = String(formData.get('recurrence') ?? 'once')
    const dueDate = String(formData.get('due_date') ?? '')
    const amount = Number(formData.get('amount') ?? 0)
    const description = String(formData.get('description') ?? '').trim()

    await sb.from('finance_payables').insert({
      organization_id: orgId,
      description,
      supplier: String(formData.get('supplier') ?? '').trim() || null,
      amount,
      due_date: dueDate,
      recurrence,
      category_id: String(formData.get('category_id') ?? '') || null,
      fund_id: String(formData.get('fund_id') ?? '') || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
      status: 'pending',
      created_by: user.id,
    })

    // Se mensal, gera os próximos 11 meses também
    if (recurrence === 'monthly' && dueDate) {
      const base = new Date(`${dueDate}T00:00:00`)
      const extras = Array.from({ length: 11 }, (_, i) => {
        const d = new Date(base.getFullYear(), base.getMonth() + i + 1, base.getDate())
        return {
          organization_id: orgId,
          description,
          supplier: String(formData.get('supplier') ?? '').trim() || null,
          amount,
          due_date: d.toISOString().slice(0, 10),
          recurrence,
          category_id: String(formData.get('category_id') ?? '') || null,
          fund_id: String(formData.get('fund_id') ?? '') || null,
          status: 'pending',
          created_by: user.id,
        }
      })
      await sb.from('finance_payables').insert(extras)
    }

    redirect(`/${slug}/financeiro/contas-pagar`)
  }

  const handleMarkPaid = async (formData: FormData) => {
    'use server'
    await createAdminClient().from('finance_payables').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: user.id,
    }).eq('id', String(formData.get('payable_id') ?? ''))
    redirect(`/${slug}/financeiro/contas-pagar`)
  }

  const handleCancel = async (formData: FormData) => {
    'use server'
    await createAdminClient().from('finance_payables').update({ status: 'cancelled' })
      .eq('id', String(formData.get('payable_id') ?? ''))
    redirect(`/${slug}/financeiro/contas-pagar`)
  }

  const grouped = [
    { key: 'overdue', label: 'Vencidas', items: overdueItems },
    { key: 'soon', label: 'Vencem em 7 dias', items: dueSoon.filter(p => !overdueItems.find(o => o.id === p.id)) },
    { key: 'month', label: 'Este mês', items: dueThisMonth.filter(p => !overdueItems.find(o => o.id === p.id) && !dueSoon.find(s => s.id === p.id)) },
    { key: 'other', label: 'Próximas', items: payables.filter(p => p.status === 'pending' && p.due_date > monthEnd) },
    { key: 'paid', label: 'Pagas', items: payables.filter(p => p.status === 'paid').slice(0, 20) },
  ]

  return (
    <>
      <Header
        title="Contas a Pagar"
        actions={
          <Link href={`/${slug}/financeiro`} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            ← Financeiro
          </Link>
        }
      />
      <main className="p-4 md:p-6 space-y-6">

        {/* KPIs */}
        <ContasPagarKpiCards
          totalOverdue={totalOverdue} totalMonth={totalMonth} totalPaid={totalPaid}
          overdueItems={overdueItems as Parameters<typeof ContasPagarKpiCards>[0]['overdueItems']}
          dueThisMonth={dueThisMonth as Parameters<typeof ContasPagarKpiCards>[0]['dueThisMonth']}
          paidItems={payables.filter(p => p.status === 'paid').slice(0, 30) as Parameters<typeof ContasPagarKpiCards>[0]['paidItems']}
        />

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          {/* Lista agrupada */}
          <div className="space-y-4">
            {grouped.map(g => g.items.length > 0 && (
              <section key={g.key} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className={`border-b px-4 py-2.5 ${g.key === 'overdue' ? 'border-red-100 bg-red-50' : 'border-gray-100'}`}>
                  <h3 className={`text-xs font-semibold uppercase tracking-wide ${g.key === 'overdue' ? 'text-red-700' : 'text-gray-500'}`}>
                    {g.label} · {g.items.length}
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {g.items.map(p => (
                    <div key={p.id} className="group relative flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-gray-900 truncate">{p.description}</p>
                        <p className="text-xs text-gray-400">
                          {p.supplier ? `${p.supplier} · ` : ''}
                          {new Date(`${p.due_date}T00:00:00`).toLocaleDateString('pt-BR')}
                          {p.finance_categories?.name ? ` · ${p.finance_categories.name}` : ''}
                          {p.finance_funds?.name ? ` · ${p.finance_funds.name}` : ''}
                          {' · '}<span className="italic">{RECURRENCE_MAP[p.recurrence] ?? p.recurrence}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_MAP[p.status]?.cls ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_MAP[p.status]?.label ?? p.status}
                        </span>
                        <span className="font-semibold text-sm text-gray-900 w-24 text-right">{fmt(Number(p.amount))}</span>
                        {p.status === 'pending' && (
                          <div className="flex gap-1">
                            <form action={handleMarkPaid}>
                              <input type="hidden" name="payable_id" value={p.id} />
                              <button type="submit" title="Marcar como pago" className="text-xs font-medium text-green-600 hover:text-green-700 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors whitespace-nowrap">
                                Pago
                              </button>
                            </form>
                            <form action={handleCancel}>
                              <input type="hidden" name="payable_id" value={p.id} />
                              <button type="submit" title="Cancelar" className="text-xs text-gray-400 hover:text-gray-600 px-1 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                                ✕
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Form criar */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden self-start">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-800">Nova conta a pagar</h2>
              <p className="text-xs text-gray-400">Se mensal, gera os próximos 12 meses automaticamente.</p>
            </div>
            <form action={handleCreate} className="space-y-3 p-4">
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-600">Descrição *</span>
                <input name="description" required placeholder="Ex: Conta de energia elétrica" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-600">Fornecedor / empresa</span>
                <input name="supplier" placeholder="Ex: Copel, Sanepar, etc." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Valor *</span>
                  <input name="amount" type="number" step="0.01" min="0" required placeholder="0,00" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">1º Vencimento *</span>
                  <input name="due_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </label>
              </div>
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-600">Recorrência</span>
                <select name="recurrence" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="once">Único (só este)</option>
                  <option value="monthly">Mensal (gera 12 meses)</option>
                  <option value="annual">Anual</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-600">Categoria</span>
                <select name="category_id" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="">Sem categoria</option>
                  {categoryRows.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-600">Fundo</span>
                <select name="fund_id" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="">Sem fundo</option>
                  {fundRows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-600">Observação</span>
                <input name="notes" placeholder="Opcional" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </label>
              <button className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors">
                Registrar conta
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  )
}
