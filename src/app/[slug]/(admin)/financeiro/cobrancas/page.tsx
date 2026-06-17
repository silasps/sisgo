import { CobrancasKpiCards } from './CobrancasKpiCards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { userHasAnyRole, GENERAL_FINANCE_ROLES } from '@/lib/auth/permissions'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ status?: string; month?: string }> }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pendente',  cls: 'bg-yellow-100 text-yellow-700' },
  paid:      { label: 'Pago',      cls: 'bg-green-100 text-green-700' },
  overdue:   { label: 'Atrasado',  cls: 'bg-red-100 text-red-600' },
  waived:    { label: 'Dispensado', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
}

const ORIGIN_MAP: Record<string, string> = {
  manual:      'Manual',
  school_fee:  'Escola',
  housing:     'Moradia',
  meal_plan:   'Alimentação',
  tax:         'Taxa',
  batch:       'Lote',
}

export default async function CobrancasPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { status: filterStatus, month: filterMonth } = await searchParams
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
  const currentMonth = filterMonth ?? today.toISOString().slice(0, 7)
  const monthStart = `${currentMonth}-01`
  const monthEnd = new Date(Number(currentMonth.split('-')[0]), Number(currentMonth.split('-')[1]), 0)
    .toISOString().slice(0, 10)

  let query = sbAdmin
    .from('finance_charges')
    .select('*')
    .eq('organization_id', orgId)
    .order('due_date', { ascending: true })
    .limit(200)

  if (filterStatus && filterStatus !== 'all') query = query.eq('status', filterStatus)
  else query = query.gte('due_date', monthStart).lte('due_date', monthEnd)

  const { data: chargesData } = await query
  type ChargeRow = { id: string; person_id: string | null; person_name_snapshot: string | null; description: string; amount: number; due_date: string; status: string; origin: string; reference_month: string | null; notes: string | null }
  const charges = (chargesData ?? []) as ChargeRow[]

  // Stats
  const pending = charges.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)
  const overdue = charges.filter(c => c.status === 'overdue').reduce((s, c) => s + Number(c.amount), 0)
  const paid = charges.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount), 0)
  const pendingCount = charges.filter(c => ['pending', 'overdue'].includes(c.status)).length

  // People for selector
  const { data: peopleData } = await sbAdmin.from('people').select('id, full_name').eq('organization_id', orgId).order('full_name').limit(300)
  const people = (peopleData ?? []) as Array<{ id: string; full_name: string }>

  // Price items for batch
  const { data: priceTablesData } = await sbAdmin
    .from('finance_price_tables')
    .select('id, name, finance_price_items(id, description, amount, unit_type, category)')
    .eq('organization_id', orgId)
    .eq('active', true)
    .order('period_start', { ascending: false })
    .limit(5)
  type PriceTableLight = { id: string; name: string; finance_price_items: Array<{ id: string; description: string; amount: number; unit_type: string; category: string }> }
  const priceTables = (priceTablesData ?? []) as unknown as PriceTableLight[]

  // Fee rules
  const { data: feeRulesData } = await sbAdmin.from('finance_fee_rules').select('*').eq('organization_id', orgId).order('person_category')
  type FeeRule = { id: string; person_category: string; description: string; amount: number; active: boolean }
  const feeRules = (feeRulesData ?? []) as FeeRule[]

  const handleCreateCharge = async (formData: FormData) => {
    'use server'
    const personId = String(formData.get('person_id') ?? '') || null
    let nameSnapshot: string | null = null
    if (personId) {
      const { data: p } = await createAdminClient().from('people').select('full_name').eq('id', personId).single()
      nameSnapshot = p?.full_name ?? null
    } else {
      nameSnapshot = String(formData.get('person_name') ?? '').trim() || null
    }
    await createAdminClient().from('finance_charges').insert({
      organization_id: orgId,
      person_id: personId,
      person_name_snapshot: nameSnapshot,
      description: String(formData.get('description') ?? '').trim(),
      amount: Number(formData.get('amount') ?? 0),
      due_date: String(formData.get('due_date') ?? ''),
      status: 'pending',
      origin: 'manual',
      reference_month: String(formData.get('reference_month') ?? '') || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
      created_by: user.id,
    })
    redirect(`/${slug}/financeiro/cobrancas`)
  }

  const handleMarkPaid = async (formData: FormData) => {
    'use server'
    await createAdminClient().from('finance_charges').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: user.id,
    }).eq('id', String(formData.get('charge_id') ?? ''))
    redirect(`/${slug}/financeiro/cobrancas`)
  }

  const handleMarkOverdue = async () => {
    'use server'
    const today = new Date().toISOString().slice(0, 10)
    await createAdminClient()
      .from('finance_charges')
      .update({ status: 'overdue' })
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .lt('due_date', today)
    redirect(`/${slug}/financeiro/cobrancas`)
  }

  const handleBatchGenerate = async (formData: FormData) => {
    'use server'
    const refMonth = String(formData.get('ref_month') ?? '')
    const priceItemId = String(formData.get('price_item_id') ?? '') || null
    const personIds = formData.getAll('person_ids').map(String).filter(Boolean)
    const description = String(formData.get('description') ?? '').trim()
    const amount = Number(formData.get('amount') ?? 0)
    const dueDate = String(formData.get('due_date') ?? '')
    const origin = String(formData.get('origin') ?? 'batch')

    if (personIds.length === 0 || !description || !dueDate) {
      redirect(`/${slug}/financeiro/cobrancas`)
    }

    const sb = createAdminClient()
    const inserts = await Promise.all(personIds.map(async (pid) => {
      const { data: p } = await sb.from('people').select('full_name').eq('id', pid).single()
      return {
        organization_id: orgId,
        person_id: pid,
        person_name_snapshot: p?.full_name ?? null,
        description,
        amount,
        due_date: dueDate,
        status: 'pending',
        origin,
        reference_month: refMonth || null,
        price_item_id: priceItemId,
        created_by: user.id,
      }
    }))
    await sb.from('finance_charges').insert(inserts)
    redirect(`/${slug}/financeiro/cobrancas`)
  }

  const handleCreateFeeRule = async (formData: FormData) => {
    'use server'
    await createAdminClient().from('finance_fee_rules').insert({
      organization_id: orgId,
      person_category: String(formData.get('person_category') ?? 'obreiro'),
      description: String(formData.get('description') ?? '').trim(),
      amount: Number(formData.get('amount') ?? 0),
      created_by: user.id,
    })
    redirect(`/${slug}/financeiro/cobrancas`)
  }

  const handleDeleteFeeRule = async (formData: FormData) => {
    'use server'
    await createAdminClient().from('finance_fee_rules').delete().eq('id', String(formData.get('rule_id') ?? ''))
    redirect(`/${slug}/financeiro/cobrancas`)
  }

  const handleGenerateMonthly = async (formData: FormData) => {
    'use server'
    const refMonth = String(formData.get('ref_month') ?? '')
    const dueDate = String(formData.get('due_date') ?? '')
    if (!refMonth || !dueDate) redirect(`/${slug}/financeiro/cobrancas`)

    const sb = createAdminClient()
    const { data: rules } = await sb.from('finance_fee_rules').select('*').eq('organization_id', orgId).eq('active', true)
    if (!rules || rules.length === 0) redirect(`/${slug}/financeiro/cobrancas`)

    const allInserts: object[] = []

    for (const rule of rules as FeeRule[]) {
      let profiles: Array<{ person_id: string }> = []

      if (rule.person_category === 'obreiro') {
        const { data } = await sb.from('staff_profiles').select('person_id').eq('organization_id', orgId).eq('active', true)
        profiles = (data ?? []) as Array<{ person_id: string }>
      } else if (rule.person_category === 'aluno') {
        const { data } = await sb.from('student_profiles').select('person_id').eq('organization_id', orgId).eq('active', true)
        profiles = (data ?? []) as Array<{ person_id: string }>
      } else if (rule.person_category === 'associado') {
        const { data } = await sb.from('associado_profiles').select('person_id').eq('organization_id', orgId).eq('active', true)
        profiles = (data ?? []) as Array<{ person_id: string }>
      }

      const personIds = profiles.map(p => p.person_id).filter(Boolean)
      if (personIds.length === 0) continue

      // Check which already have charges for this reference_month + description
      const { data: existing } = await sb.from('finance_charges')
        .select('person_id').eq('organization_id', orgId)
        .eq('reference_month', refMonth).eq('description', rule.description)
      const existingSet = new Set((existing ?? []).map((e: { person_id: string | null }) => e.person_id))

      const newPersonIds = personIds.filter(pid => !existingSet.has(pid))
      if (newPersonIds.length === 0) continue

      const { data: peopleNames } = await sb.from('people').select('id, full_name').in('id', newPersonIds)
      const nameMap = new Map((peopleNames ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]))

      for (const pid of newPersonIds) {
        allInserts.push({
          organization_id: orgId,
          person_id: pid,
          person_name_snapshot: nameMap.get(pid) ?? null,
          description: rule.description,
          amount: rule.amount,
          due_date: dueDate,
          status: 'pending',
          origin: 'tax',
          reference_month: refMonth,
          created_by: user.id,
        })
      }
    }

    if (allInserts.length > 0) {
      await sb.from('finance_charges').insert(allInserts)
    }

    redirect(`/${slug}/financeiro/cobrancas?month=${refMonth}`)
  }

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    return { value: d.toISOString().slice(0, 7), label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }
  })

  return (
    <>
      <Header
        title="Cobranças"
        actions={
          <Link href={`/${slug}/financeiro`} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            ← Financeiro
          </Link>
        }
      />
      <main className="p-4 md:p-6 space-y-6">

        {/* KPIs */}
        <CobrancasKpiCards
          pending={pending} overdue={overdue} paid={paid} pendingCount={pendingCount}
          allCharges={charges as Parameters<typeof CobrancasKpiCards>[0]['allCharges']}
        />

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          {/* Tabela de cobranças */}
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-medium text-gray-500">Filtrar:</span>
              {[
                { label: 'Mês atual', href: `/${slug}/financeiro/cobrancas` },
                { label: 'Pendentes', href: `/${slug}/financeiro/cobrancas?status=pending` },
                { label: 'Atrasados', href: `/${slug}/financeiro/cobrancas?status=overdue` },
                { label: 'Pagos', href: `/${slug}/financeiro/cobrancas?status=paid` },
                { label: 'Todos', href: `/${slug}/financeiro/cobrancas?status=all` },
              ].map(f => (
                <Link key={f.label} href={f.href}
                  className="text-xs px-3 py-1 rounded-full border border-gray-200 hover:border-brand-300 hover:text-brand-600 transition-colors bg-white">
                  {f.label}
                </Link>
              ))}
              <form method="get" action={`/${slug}/financeiro/cobrancas`} className="flex items-center gap-1">
                <select name="month" defaultValue={currentMonth} className="text-xs px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <button type="submit" className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Ver</button>
              </form>

              {/* Marcar vencidas */}
              <form action={handleMarkOverdue} className="ml-auto">
                <button type="submit" className="text-xs px-3 py-1 rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                  Marcar vencidas
                </button>
              </form>
            </div>

            {charges.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-gray-400 text-sm">Nenhuma cobrança encontrada para este filtro.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Pessoa</th>
                      <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Descrição</th>
                      <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Vencimento</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {charges.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">{c.person_name_snapshot ?? '—'}</p>
                          <p className="text-xs text-gray-400">{ORIGIN_MAP[c.origin] ?? c.origin}{c.reference_month ? ` · ${c.reference_month}` : ''}</p>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-gray-600 text-sm">{c.description}</td>
                        <td className="hidden sm:table-cell px-4 py-3 text-gray-500 text-sm">
                          {new Date(`${c.due_date}T00:00:00`).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[c.status]?.cls ?? 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_MAP[c.status]?.label ?? c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(Number(c.amount))}</td>
                        <td className="px-4 py-3 text-right">
                          {['pending', 'overdue'].includes(c.status) && (
                            <form action={handleMarkPaid} className="inline">
                              <input type="hidden" name="charge_id" value={c.id} />
                              <button type="submit" className="text-xs font-medium text-green-600 hover:text-green-700 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors whitespace-nowrap">
                                Marcar pago
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">

            {/* Gerar mês automático */}
            <div className="rounded-xl border border-brand-200 bg-brand-50 overflow-hidden">
              <div className="border-b border-brand-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-brand-800">Gerar mês automático</h2>
                <p className="text-xs text-brand-600">Gera cobranças para todos os obreiros/alunos com base nas regras abaixo.</p>
              </div>
              <form action={handleGenerateMonthly} className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-brand-700">Mês referência *</span>
                    <input name="ref_month" type="month" required defaultValue={currentMonth} className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white" />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-brand-700">Vencimento *</span>
                    <input name="due_date" type="date" required className="w-full rounded-lg border border-brand-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white" />
                  </label>
                </div>
                {feeRules.filter(r => r.active).length === 0 ? (
                  <p className="text-xs text-brand-600 bg-white rounded-lg p-3 border border-brand-200">
                    Nenhuma regra de taxa configurada ainda. Crie uma regra abaixo antes de gerar.
                  </p>
                ) : (
                  <div className="rounded-lg bg-white border border-brand-200 divide-y divide-brand-100">
                    {feeRules.filter(r => r.active).map(r => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <p className="text-xs font-medium text-gray-800">{r.description}</p>
                          <p className="text-xs text-gray-400">{ { obreiro: 'Obreiros ativos', aluno: 'Alunos ativos', associado: 'Associados ativos' }[r.person_category] ?? r.person_category} · {fmt(Number(r.amount))}</p>
                        </div>
                        <form action={handleDeleteFeeRule}>
                          <input type="hidden" name="rule_id" value={r.id} />
                          <button type="submit" className="text-gray-300 hover:text-red-400 transition-colors p-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
                <button className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors">
                  Gerar cobranças do mês
                </button>
              </form>

              {/* Criar regra */}
              <details className="border-t border-brand-100">
                <summary className="px-4 py-2.5 text-xs font-medium text-brand-700 hover:bg-brand-100 cursor-pointer transition-colors list-none">
                  + Nova regra de taxa
                </summary>
                <form action={handleCreateFeeRule} className="grid gap-2 bg-white px-4 pb-4 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <label>
                      <span className="mb-1 block text-xs font-medium text-gray-600">Categoria</span>
                      <select name="person_category" className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                        <option value="obreiro">Obreiros ativos</option>
                        <option value="aluno">Alunos ativos</option>
                        <option value="associado">Associados ativos</option>
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-medium text-gray-600">Valor (R$)</span>
                      <input name="amount" type="number" step="0.01" min="0" required placeholder="0,00" className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    </label>
                  </div>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-gray-600">Descrição da cobrança</span>
                    <input name="description" required placeholder="Ex: Taxa mensal obreiro" className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </label>
                  <button className="rounded-lg bg-brand-500 hover:bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors">
                    Criar regra
                  </button>
                </form>
              </details>
            </div>

            {/* Manual */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-800">Nova cobrança manual</h2>
              </div>
              <form action={handleCreateCharge} className="space-y-3 p-4">
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Pessoa cadastrada</span>
                  <select name="person_id" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    <option value="">— Nome avulso →</option>
                    {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Ou nome avulso</span>
                  <input name="person_name" placeholder="Nome se não cadastrado" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Descrição *</span>
                  <input name="description" required placeholder="Ex: Mensalidade moradia jun/26" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-gray-600">Valor *</span>
                    <input name="amount" type="number" step="0.01" min="0" required placeholder="0,00" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-gray-600">Vencimento *</span>
                    <input name="due_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </label>
                </div>
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Mês referência</span>
                  <input name="reference_month" type="month" defaultValue={currentMonth} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </label>
                <button className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors">
                  Criar cobrança
                </button>
              </form>
            </div>

            {/* Lote */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-800">Gerar cobranças em lote</h2>
                <p className="text-xs text-gray-400">Selecione um item da tabela + as pessoas para gerar cobranças de uma vez.</p>
              </div>
              <form action={handleBatchGenerate} className="space-y-3 p-4">
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Item da tabela de valores</span>
                  <select name="price_item_id" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    <option value="">— Nenhum (preencher manualmente) —</option>
                    {priceTables.map(t => (
                      <optgroup key={t.id} label={t.name}>
                        {t.finance_price_items.map(item => (
                          <option key={item.id} value={item.id} data-amount={item.amount}>
                            {item.description} — {fmt(Number(item.amount))}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Descrição *</span>
                  <input name="description" required placeholder="Ex: Mensalidade moradia - Jul/26" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-gray-600">Valor *</span>
                    <input name="amount" type="number" step="0.01" min="0" required placeholder="0,00" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-gray-600">Vencimento *</span>
                    <input name="due_date" type="date" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </label>
                </div>
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Mês referência</span>
                  <input name="ref_month" type="month" defaultValue={currentMonth} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </label>
                <input type="hidden" name="origin" value="batch" />
                <label>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Pessoas *</span>
                  <select name="person_ids" multiple required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 h-32">
                    {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                  <span className="text-xs text-gray-400">Segure Ctrl/Cmd para selecionar várias</span>
                </label>
                <button className="w-full rounded-lg bg-gray-900 hover:bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors">
                  Gerar cobranças
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
