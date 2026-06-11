import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getRolePreview } from '@/lib/role-preview'
import { notFound, redirect } from 'next/navigation'
import type { InputHTMLAttributes } from 'react'
import { asLooseClient, type LooseSupabaseClient } from '@/lib/supabase/loose-client'

type Props = { params: Promise<{ slug: string }> }

type CashScope = {
  id: string
  organization_id: string
  entity_type: 'school' | 'ministry'
  school_id: string | null
  ministry_id: string | null
  name_snapshot: string | null
  enabled: boolean
}

type Transaction = {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  date: string
  status: string
  payment_method: string | null
  reference_code: string | null
  notes: string | null
  finance_categories: { name: string } | null
}

export default async function AreaCashPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const admin = asLooseClient(createAdminClient())

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userId = user.id

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org?.id) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', userId)
    .eq('active', true)

  const memberships = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
  const superadminRow = memberships.find(row => row.roles?.name === 'superadmin')
  const currentOrgRow = memberships.find(row => row.organization_id === org.id)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  const preview = await getRolePreview(realRole)
  const role = preview?.role ?? realRole

  if (realRole !== 'superadmin' && !currentOrgRow) redirect('/login')
  if (role !== 'lider_eted' && role !== 'lider_ministerio') notFound()

  const scope = await resolveCashScope({
    admin,
    organizationId: org.id,
    userId,
    role,
    previewSchoolId: preview?.role === 'lider_eted' ? preview.schoolId : null,
    previewMinistryId: preview?.role === 'lider_ministerio' ? preview.ministryId : null,
  })

  if (!scope) {
    return (
      <>
        <Header title="Caixa da área" />
        <main className="p-4 md:p-6">
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-gray-700">Caixa próprio não ativado para esta área.</p>
            <p className="mt-1 text-xs text-gray-400">O líder da base pode ativar em Configurações, por escola ou ministério.</p>
          </div>
        </main>
      </>
    )
  }

  const [{ data: transactionsData }, { data: categoriesData }] = await Promise.all([
    admin
      .from('financial_transactions')
      .select('id, description, amount, type, date, status, payment_method, reference_code, notes, finance_categories(name)')
      .eq('organization_id', org.id)
      .eq('cash_scope_id', scope.id)
      .order('date', { ascending: false })
      .limit(80),
    admin
      .from('finance_categories')
      .select('id, name, type')
      .eq('organization_id', org.id)
      .eq('active', true)
      .order('name'),
  ])

  const transactions = (transactionsData ?? []) as Transaction[]
  const categories = (categoriesData ?? []) as Array<{ id: string; name: string; type: string }>
  const receitas = transactions.filter(item => item.type === 'income').reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const despesas = transactions.filter(item => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const saldo = receitas - despesas
  const title = scope.entity_type === 'school' ? 'Caixa da escola' : 'Caixa do ministério'

  async function createAreaTransaction(formData: FormData) {
    'use server'
    if (!scope) notFound()

    const db = asLooseClient(createAdminClient())
    const categoryId = String(formData.get('category_id') ?? '') || null
    const categoryResult = categoryId
      ? await db.from('finance_categories').select('name').eq('id', categoryId).maybeSingle()
      : null
    const category = categoryResult?.data as { name: string } | null | undefined
    const categoryName = categoryId
      ? (category?.name ?? null)
      : null
    const type = String(formData.get('type') ?? 'income') === 'expense' ? 'expense' : 'income'

    await db.from('financial_transactions').insert({
      organization_id: scope.organization_id,
      cash_scope_id: scope.id,
      school_id: scope.school_id,
      ministry_id: scope.ministry_id,
      description: String(formData.get('description') ?? '').trim(),
      amount: Number(formData.get('amount') ?? 0),
      type,
      category: categoryName,
      category_id: categoryId,
      date: String(formData.get('date') ?? '') || new Date().toISOString().slice(0, 10),
      status: String(formData.get('status') ?? 'paid'),
      payment_method: String(formData.get('payment_method') ?? '').trim() || null,
      reference_code: String(formData.get('reference_code') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
      created_by: userId,
      approved_by: userId,
      approved_at: new Date().toISOString(),
    })

    redirect(`/${slug}/caixa`)
  }

  const fmt = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <>
      <Header title={title} />
      <main className="space-y-6 p-4 md:p-6">
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Caixa próprio separado do caixa geral da base</p>
          <h2 className="mt-1 text-lg font-semibold text-blue-950">{scope.name_snapshot ?? 'Área'}</h2>
          <p className="mt-1 text-sm text-blue-700">
            Este saldo pertence à área selecionada. O Financeiro da base consegue visualizar, mas ele não entra automaticamente como dinheiro disponível da base.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Summary label="Entradas" value={fmt(receitas)} className="text-green-600" />
          <Summary label="Saídas" value={fmt(despesas)} className="text-red-500" />
          <Summary label="Saldo do caixa" value={fmt(saldo)} className={saldo >= 0 ? 'text-gray-900' : 'text-red-600'} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <form action={createAreaTransaction} className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-800">Novo lançamento da área</h2>
            <div className="mt-4 grid gap-3">
              <Field name="description" label="Descrição" required placeholder="Ex: Oferta recebida, material da escola, apostilas..." />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select name="type" label="Tipo" options={[['income', 'Entrada'], ['expense', 'Saída']]} />
                <Field name="amount" label="Valor" type="number" step="0.01" min="0" required />
              </div>
              <Select name="category_id" label="Categoria" options={[['', 'Sem categoria'], ...categories.map(category => [category.id, category.name] as [string, string])]} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="date" label="Data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                <Select name="status" label="Status" options={[['paid', 'Confirmado'], ['pending', 'Pendente'], ['cancelled', 'Cancelado']]} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="payment_method" label="Método" placeholder="Pix, dinheiro, cartão..." />
                <Field name="reference_code" label="Referência" placeholder="Recibo, comprovante..." />
              </div>
              <label>
                <span className="mb-1 block text-xs font-medium text-gray-600">Observação</span>
                <textarea name="notes" rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </label>
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Registrar no caixa</button>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-800">Movimentações</h2>
            </div>
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Nenhum lançamento nesse caixa ainda.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="hidden md:table-cell px-4 py-3">Data</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{item.description}</p>
                        <p className="text-xs text-gray-400">{item.finance_categories?.name ?? 'Sem categoria'} · {item.status}</p>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-gray-500">
                        {new Date(`${item.date}T00:00:00`).toLocaleDateString('pt-BR')}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${item.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                        {item.type === 'income' ? '+' : '-'}{fmt(Number(item.amount ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </>
  )
}

async function resolveCashScope({
  admin,
  organizationId,
  userId,
  role,
  previewSchoolId,
  previewMinistryId,
}: {
  admin: LooseSupabaseClient
  organizationId: string
  userId: string
  role: string
  previewSchoolId: string | null
  previewMinistryId: string | null
}): Promise<CashScope | null> {
  if (role === 'lider_eted') {
    const leaderResult = previewSchoolId
      ? null
      : await admin.from('school_leaders').select('school_id').eq('organization_id', organizationId).eq('user_id', userId).limit(1).maybeSingle()
    const leader = leaderResult?.data as { school_id: string } | null | undefined
    const schoolId = previewSchoolId
      ?? leader?.school_id
      ?? null
    if (!schoolId) return null

    const { data } = await admin
      .from('finance_cash_scopes')
      .select('id, organization_id, entity_type, school_id, ministry_id, name_snapshot, enabled')
      .eq('organization_id', organizationId)
      .eq('entity_type', 'school')
      .eq('school_id', schoolId)
      .eq('enabled', true)
      .maybeSingle()
    return data as CashScope | null
  }

  const leaderResult = previewMinistryId
    ? null
    : await admin.from('ministry_leaders').select('ministry_id').eq('organization_id', organizationId).eq('user_id', userId).limit(1).maybeSingle()
  const leader = leaderResult?.data as { ministry_id: string } | null | undefined
  const ministryId = previewMinistryId
    ?? leader?.ministry_id
    ?? null
  if (!ministryId) return null

  const { data } = await admin
    .from('finance_cash_scopes')
    .select('id, organization_id, entity_type, school_id, ministry_id, name_snapshot, enabled')
    .eq('organization_id', organizationId)
    .eq('entity_type', 'ministry')
    .eq('ministry_id', ministryId)
    .eq('enabled', true)
    .maybeSingle()
  return data as CashScope | null
}

function Summary({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className={`text-xl font-bold ${className}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  )
}

function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
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
        {options.map(([value, labelText]) => <option key={`${name}-${value}`} value={value}>{labelText}</option>)}
      </select>
    </label>
  )
}
