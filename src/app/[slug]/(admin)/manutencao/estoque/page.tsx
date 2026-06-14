import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getRolePreview } from '@/lib/role-preview'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { userHasAnyRole, MANUTENCAO_ROLES } from '@/lib/auth/permissions'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string; tab?: string }>
}

type StockItem = {
  id: string
  code: string | null
  name: string
  category: string | null
  unit: string
  quantity: number
  min_quantity: number
  location: string | null
  notes: string | null
}

const CATEGORIES = ['Elétrico','Hidráulico','Ferramentas','Limpeza','Construção','Iluminação','Fixação','Outro']
const UNITS      = ['un','kg','g','L','mL','m','cm','rolo','cx','par','pc']

const MOV_LABEL: Record<string, string> = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' }
const MOV_CLS:   Record<string, string> = {
  entrada: 'text-green-700 bg-green-50',
  saida:   'text-red-700 bg-red-50',
  ajuste:  'text-blue-700 bg-blue-50',
}

function fmtDate(d: string) { return new Date(d).toLocaleDateString('pt-BR') }
function fmtQty(q: number, u: string) { return `${q % 1 === 0 ? q : q.toFixed(2)} ${u}` }

export default async function EstoqueManutencaoPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { q = '', tab = 'estoque' } = await searchParams
  const activeTab = tab === 'movimentacoes' ? 'movimentacoes' : 'estoque'

  const supabase = await createClient()
  const sbAdmin  = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { data: orgUserRow } = await supabase
    .from('organization_users')
    .select('roles(name), extra_roles')
    .eq('user_id', user.id)
    .eq('organization_id', org.id)
    .eq('active', true)
    .maybeSingle() as { data: { roles: { name: string } | null; extra_roles?: string[] | null } | null }

  if (!orgUserRow) redirect('/login')

  const preview  = await getRolePreview(orgUserRow.roles?.name ?? '')
  const role     = preview?.role ?? orgUserRow.roles?.name ?? ''
  const accRoles = (orgUserRow.extra_roles as string[] | null) ?? []
  if (!userHasAnyRole([role, ...accRoles], MANUTENCAO_ROLES)) redirect(`/${slug}/manutencao`)

  // ── Server Actions ──────────────────────────────────────────────────────────

  const handleCreateItem = async (formData: FormData) => {
    'use server'
    const name         = String(formData.get('name') ?? '').trim()
    if (!name) return
    const code         = String(formData.get('code') ?? '').trim() || null
    const category     = String(formData.get('category') ?? '').trim() || null
    const unit         = String(formData.get('unit') ?? 'un').trim() || 'un'
    const min_quantity = Number(formData.get('min_quantity') ?? 0)
    const location     = String(formData.get('location') ?? '').trim() || null
    const notes        = String(formData.get('notes') ?? '').trim() || null
    const { data: { user: u } } = await (await createClient()).auth.getUser()
    if (!u) return
    await sbAdmin.from('maintenance_stock_items').insert({
      organization_id: org.id, code, name, category, unit, quantity: 0, min_quantity, location, notes, created_by: u.id,
    })
    redirect(`/${slug}/manutencao/estoque?tab=estoque`)
  }

  const handleMovement = async (formData: FormData) => {
    'use server'
    const item_id       = String(formData.get('item_id') ?? '')
    const movement_type = String(formData.get('movement_type') ?? '') as 'entrada' | 'saida' | 'ajuste'
    const quantity      = Number(formData.get('quantity') ?? 0)
    const reason        = String(formData.get('reason') ?? '').trim() || null
    const movement_date = String(formData.get('movement_date') ?? new Date().toISOString().split('T')[0])
    if (!item_id || !quantity || quantity <= 0) return

    const { data: item } = await sbAdmin.from('maintenance_stock_items').select('quantity').eq('id', item_id).single()
    if (!item) return

    const delta  = movement_type === 'entrada' ? quantity : movement_type === 'saida' ? -quantity : quantity - item.quantity
    const newQty = item.quantity + delta

    const { data: { user: u } } = await (await createClient()).auth.getUser()
    if (!u) return

    await sbAdmin.from('maintenance_stock_movements').insert({
      organization_id: org.id, item_id, movement_type, quantity, reason, movement_date, created_by: u.id,
    })
    await sbAdmin.from('maintenance_stock_items').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', item_id)
    redirect(`/${slug}/manutencao/estoque?tab=estoque`)
  }

  const handleRemoveItem = async (formData: FormData) => {
    'use server'
    const id = String(formData.get('id') ?? '')
    if (!id) return
    await sbAdmin.from('maintenance_stock_items').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id)
    redirect(`/${slug}/manutencao/estoque?tab=estoque`)
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  let itemsQuery = sbAdmin
    .from('maintenance_stock_items')
    .select('id, code, name, category, unit, quantity, min_quantity, location, notes')
    .eq('organization_id', org.id)
    .eq('active', true)
    .order('name')
  if (q) itemsQuery = itemsQuery.ilike('name', `%${q}%`)
  const { data: itemsData } = await itemsQuery
  const items = (itemsData ?? []) as StockItem[]

  const { data: movData } = await sbAdmin
    .from('maintenance_stock_movements')
    .select('id, item_id, movement_type, quantity, reason, movement_date')
    .eq('organization_id', org.id)
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)
  const movements = (movData ?? []) as Array<{
    id: string; item_id: string; movement_type: string; quantity: number; reason: string | null; movement_date: string
  }>

  const itemById   = new Map(items.map(i => [i.id, i]))
  const lowStock   = items.filter(i => i.min_quantity > 0 && i.quantity <= i.min_quantity)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title="Estoque — Manutenção"
        actions={
          <Link href={`/${slug}/manutencao`} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
            ← Solicitações
          </Link>
        }
      />

      <div className="flex-1 px-4 pb-8 max-w-4xl mx-auto w-full">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total de itens</p>
            <p className="text-2xl font-bold text-gray-900">{items.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Estoque baixo</p>
            <p className={`text-2xl font-bold ${lowStock.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{lowStock.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-500 mb-1">Movimentações registradas</p>
            <p className="text-2xl font-bold text-gray-900">{movements.length >= 50 ? '50+' : movements.length}</p>
          </div>
        </div>

        {/* Alerta estoque baixo */}
        {lowStock.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-red-700 mb-2">⚠️ Itens com estoque baixo ou zerado</p>
            <ul className="space-y-1">
              {lowStock.map(i => (
                <li key={i.id} className="text-sm text-red-600">
                  {i.name} — {fmtQty(i.quantity, i.unit)} (mínimo: {fmtQty(i.min_quantity, i.unit)})
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[{ key: 'estoque', label: 'Itens' }, { key: 'movimentacoes', label: 'Movimentações' }].map(t => (
            <Link key={t.key} href={`/${slug}/manutencao/estoque?tab=${t.key}`}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-[var(--accent)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t.label}
            </Link>
          ))}
        </div>

        {activeTab === 'estoque' && (
          <>
            {/* Busca */}
            <form method="GET" className="mb-4">
              <input type="hidden" name="tab" value="estoque" />
              <input name="q" defaultValue={q} placeholder="Buscar item…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
            </form>

            {/* Novo item */}
            <details className="bg-white rounded-xl border border-gray-200 mb-4 group">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-700 list-none flex items-center justify-between select-none">
                <span>+ Novo item</span>
                <span className="text-gray-400 text-xs">▼</span>
              </summary>
              <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                <form action={handleCreateItem} className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                      <input name="name" required placeholder="Ex: Lâmpada LED 9W"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Código</label>
                      <input name="code" placeholder="Ex: LMP-LED-9W"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
                      <select name="category" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                        <option value="">—</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Unidade</label>
                      <select name="unit" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Qtd. mínima</label>
                      <input name="min_quantity" type="number" min="0" step="0.01" defaultValue="0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Local de armazenamento</label>
                      <input name="location" placeholder="Ex: Almoxarifado, Prateleira B"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                    </div>
                  </div>
                  <input name="notes" placeholder="Observações (opcional)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                  <button type="submit" className="self-start px-5 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
                    Adicionar item
                  </button>
                </form>
              </div>
            </details>

            {/* Lista de itens */}
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Nenhum item no estoque.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map(item => {
                  const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity
                  return (
                    <div key={item.id} className={`bg-white rounded-xl border p-4 ${isLow ? 'border-red-200' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">{item.name}</p>
                            {item.code && <span className="text-xs text-gray-400 font-mono">{item.code}</span>}
                            {item.category && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{item.category}</span>}
                          </div>
                          {item.location && <p className="text-xs text-gray-400 mt-0.5">📍 {item.location}</p>}
                          {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{fmtQty(item.quantity, item.unit)}</p>
                          {item.min_quantity > 0 && <p className="text-xs text-gray-400">mín: {fmtQty(item.min_quantity, item.unit)}</p>}
                        </div>
                      </div>

                      {/* Movimentação rápida */}
                      <details className="mt-3">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 select-none">Registrar movimentação</summary>
                        <form action={handleMovement} className="mt-2 flex flex-col gap-2">
                          <input type="hidden" name="item_id" value={item.id} />
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                              <select name="movement_type" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                                <option value="entrada">Entrada</option>
                                <option value="saida">Saída</option>
                                <option value="ajuste">Ajuste</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Qtd. ({item.unit})</label>
                              <input name="quantity" type="number" min="0.01" step="0.01" required placeholder="0"
                                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                              <input name="movement_date" type="date" defaultValue={new Date().toISOString().split('T')[0]}
                                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                            </div>
                          </div>
                          <input name="reason" placeholder="Motivo (opcional)"
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                          <div className="flex gap-2">
                            <button type="submit" className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity">
                              Registrar
                            </button>
                            <form action={handleRemoveItem}>
                              <input type="hidden" name="id" value={item.id} />
                              <button type="submit" className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 transition-colors">
                                Remover item
                              </button>
                            </form>
                          </div>
                        </form>
                      </details>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'movimentacoes' && (
          movements.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Item</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Tipo</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Qtd.</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 hidden sm:table-cell">Motivo</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map(mv => {
                    const item = itemById.get(mv.item_id)
                    return (
                      <tr key={mv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-800">{item?.name ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${MOV_CLS[mv.movement_type] ?? 'text-gray-700 bg-gray-100'}`}>
                            {MOV_LABEL[mv.movement_type] ?? mv.movement_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700 font-mono">{mv.quantity} {item?.unit ?? ''}</td>
                        <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{mv.reason ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-400 whitespace-nowrap">{fmtDate(mv.movement_date)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
