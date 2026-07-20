import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { userHasAnyRole, GENERAL_FINANCE_ROLES } from '@/lib/auth/permissions'

type Props = { params: Promise<{ slug: string }> }

const CATEGORIES = [
  { key: 'escola_inscricao',    label: 'Inscrições de Escolas' },
  { key: 'escola_mensalidade',  label: 'Mensalidades de Escolas' },
  { key: 'taxa',                label: 'Taxas' },
  { key: 'hospedagem',          label: 'Hospedagem Visitante' },
  { key: 'diaria_equipe',       label: 'Diárias de Equipes' },
  { key: 'seminario',           label: 'Diárias Seminários' },
  { key: 'moradia',             label: 'Moradia' },
  { key: 'refeicao',            label: 'Refeições' },
]

const UNIT_LABELS: Record<string, string> = {
  monthly: '/mês',
  unit:    '/unid.',
  daily:   '/dia',
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function TabelaValoresPage({ params }: Props) {
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

  const { data: tablesData } = await sbAdmin
    .from('finance_price_tables')
    .select('*, finance_price_items(*)')
    .eq('organization_id', orgId)
    .order('period_start', { ascending: false })

  type PriceItem = { id: string; category: string; description: string; unit_type: string; amount: number; sort_order: number }
  type PriceTable = { id: string; name: string; period_start: string; period_end: string; active: boolean; notes: string | null; finance_price_items: PriceItem[] }
  const tables = (tablesData ?? []) as unknown as PriceTable[]

  const handleCreateTable = async (formData: FormData) => {
    'use server'
    await createAdminClient().from('finance_price_tables').insert({
      organization_id: orgId,
      name: String(formData.get('name') ?? '').trim(),
      period_start: String(formData.get('period_start') ?? ''),
      period_end: String(formData.get('period_end') ?? ''),
      notes: String(formData.get('notes') ?? '').trim() || null,
      created_by: user.id,
    })
    redirect(`/${slug}/financeiro/tabela-valores`)
  }

  const handleAddItem = async (formData: FormData) => {
    'use server'
    const tableId = String(formData.get('table_id') ?? '')
    await createAdminClient().from('finance_price_items').insert({
      table_id: tableId,
      organization_id: orgId,
      category: String(formData.get('category') ?? 'taxa'),
      description: String(formData.get('description') ?? '').trim(),
      unit_type: String(formData.get('unit_type') ?? 'monthly'),
      amount: Number(formData.get('amount') ?? 0),
      sort_order: Number(formData.get('sort_order') ?? 0),
    })
    redirect(`/${slug}/financeiro/tabela-valores`)
  }

  const handleDeleteItem = async (formData: FormData) => {
    'use server'
    await createAdminClient().from('finance_price_items').delete().eq('id', String(formData.get('item_id') ?? ''))
    redirect(`/${slug}/financeiro/tabela-valores`)
  }

  const handleToggleTable = async (formData: FormData) => {
    'use server'
    const id = String(formData.get('table_id') ?? '')
    const active = formData.get('active') === 'true'
    await createAdminClient().from('finance_price_tables').update({ active: !active }).eq('id', id)
    redirect(`/${slug}/financeiro/tabela-valores`)
  }

  return (
    <>
      <Header
        title="Tabela de Valores"
        actions={
          <Link href={`/${slug}/financeiro`} className="text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            ← Financeiro
          </Link>
        }
      />
      <main className="p-4 md:p-6 space-y-6 max-w-5xl">

        {/* Nova tabela */}
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Nova tabela de valores</h2>
            <p className="text-xs text-gray-400">Crie uma tabela por semestre ou vigência. Cada tabela tem seus próprios itens.</p>
          </div>
          <form action={handleCreateTable} className="grid gap-3 p-4 sm:grid-cols-4">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-gray-600">Nome da tabela</span>
              <input name="name" required placeholder="Ex: 2º Semestre 2026" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-gray-600">Início da vigência</span>
              <input name="period_start" type="date" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-gray-600">Fim da vigência</span>
              <input name="period_end" type="date" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </label>
            <label className="sm:col-span-3">
              <span className="mb-1 block text-xs font-medium text-gray-600">Observação</span>
              <input name="notes" placeholder="Opcional" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </label>
            <button className="self-end rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors">
              Criar tabela
            </button>
          </form>
        </section>

        {/* Tabelas existentes */}
        {tables.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-400 text-sm">Nenhuma tabela criada ainda.</p>
          </div>
        ) : tables.map(table => {
          const byCategory = CATEGORIES.map(cat => ({
            ...cat,
            items: table.finance_price_items.filter(i => i.category === cat.key).sort((a, b) => a.sort_order - b.sort_order),
          })).filter(cat => cat.items.length > 0)

          return (
            <section key={table.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">{table.name}</h2>
                  <p className="text-xs text-gray-400">
                    {new Date(`${table.period_start}T00:00:00`).toLocaleDateString('pt-BR')} →{' '}
                    {new Date(`${table.period_end}T00:00:00`).toLocaleDateString('pt-BR')}
                    {table.notes ? ` · ${table.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${table.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {table.active ? 'Ativa' : 'Inativa'}
                  </span>
                  <form action={handleToggleTable}>
                    <input type="hidden" name="table_id" value={table.id} />
                    <input type="hidden" name="active" value={String(table.active)} />
                    <button type="submit" className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                      {table.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Itens agrupados por categoria */}
              {byCategory.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {byCategory.map(cat => (
                    <div key={cat.key} className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat.label}</p>
                      <div className="space-y-1">
                        {cat.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-gray-700 flex-1">{item.description}</span>
                            <span className="text-xs text-gray-400">{UNIT_LABELS[item.unit_type] ?? item.unit_type}</span>
                            <span className="text-sm font-semibold text-gray-900 w-24 text-right">{fmt(Number(item.amount))}</span>
                            <form action={handleDeleteItem}>
                              <input type="hidden" name="item_id" value={item.id} />
                              <button type="submit" title="Remover item" className="text-gray-300 hover:text-red-400 transition-colors p-1">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Adicionar item */}
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Adicionar item</p>
                <form action={handleAddItem} className="grid gap-2 sm:grid-cols-5">
                  <input type="hidden" name="table_id" value={table.id} />
                  <select name="category" className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <input name="description" required placeholder="Descrição" className="sm:col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  <select name="unit_type" className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400">
                    <option value="monthly">/mês</option>
                    <option value="unit">/unid.</option>
                    <option value="daily">/dia</option>
                  </select>
                  <div className="flex gap-2">
                    <input name="amount" type="number" step="0.01" min="0" required placeholder="0,00" className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    <button type="submit" className="rounded-lg bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors whitespace-nowrap">
                      + Add
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )
        })}
      </main>
    </>
  )
}
