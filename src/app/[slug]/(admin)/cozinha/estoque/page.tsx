import { StockKpiCards } from './StockKpiCards'
import { EstoqueActions } from './EstoqueActions'
import { FornecedorActions } from './FornecedorActions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getRolePreview } from '@/lib/role-preview'
import { AlertTriangle } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createStockEntry, createStockItem, createStockMovement, createStockSupplier, removeStockSupplier, updateStockSupplier, registerBarcode } from '../actions'
import { InternationalPhoneField } from '@/components/ui/InternationalPhoneField'
import { userHasAnyRole, KITCHEN_ROLES } from '@/lib/auth/permissions'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string; msg?: string; tab?: string }>
}

function normalizeCode(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .toUpperCase()
    .slice(0, 16)
}

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function fmtDate(date: string | null) {
  return date ? new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR') : '-'
}

function optionalText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim() || null
}

export default async function EstoqueCozinhaPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { q = '', msg, tab = 'estoque' } = await searchParams
  const activeTab = tab === 'fornecedores' ? 'fornecedores' : 'estoque'
  const supabase = await createClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id, role_accumulations').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name), extra_roles')
    .eq('user_id', user.id)
    .eq('active', true)

  const rows = (orgUsers ?? []) as unknown as Array<{
    organization_id: string | null
    roles: { name: string } | null
    extra_roles?: string[] | null
  }>
  const superadminRow = rows.find(row => row.roles?.name === 'superadmin')
  const currentOrgRow = rows.find(row => row.organization_id === org.id)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  const preview = await getRolePreview(realRole)
  const role = preview?.role ?? realRole
  const orgAccumulations = (org?.role_accumulations as Record<string, string[]> | null) ?? {}
  const extraRoles = (currentOrgRow?.extra_roles as string[] | null) ?? []
  if (!userHasAnyRole([role, ...(orgAccumulations[role] ?? []), ...extraRoles], KITCHEN_ROLES)) notFound()

  const sbAdmin = createAdminClient()
  let stockQuery = sbAdmin
    .from('kitchen_stock_items')
    .select('id, code, name, category, unit, quantity, min_quantity, default_location, critical, notes, barcode')
    .eq('organization_id', org.id)
    .eq('active', true)
    .order('name', { ascending: true })

  const search = q.trim()
  if (search) {
    stockQuery = stockQuery.or(`name.ilike.%${search}%,code.ilike.%${search}%,barcode.eq.${search}`)
  }

  const [{ data: stockItems }, { data: lots }, { data: movements }, { data: suppliers }, { data: barcodeRows }] = await Promise.all([
    stockQuery,
    sbAdmin
      .from('kitchen_stock_lots')
      .select('id, item_id, source_type, supplier_name, lot_code, expiration_date, quantity_current, location')
      .eq('organization_id', org.id)
      .gt('quantity_current', 0)
      .order('expiration_date', { ascending: true, nullsFirst: false })
      .limit(12),
    sbAdmin
      .from('kitchen_stock_movements')
      .select('id, item_id, movement_type, quantity, reason, movement_date, location_from, location_to')
      .eq('organization_id', org.id)
      .order('movement_date', { ascending: false })
      .limit(10),
    (() => {
      let sq = sbAdmin
        .from('kitchen_stock_suppliers')
        .select('id, name, description, contact_country_code, contact_phone, contact_email, address, cnpj, notes')
        .eq('organization_id', org.id)
        .eq('active', true)
        .order('name', { ascending: true })
      if (activeTab === 'fornecedores' && search) {
        sq = sq.or(`name.ilike.%${search}%,contact_email.ilike.%${search}%,cnpj.ilike.%${search}%`)
      }
      return sq
    })(),
    sbAdmin
      .from('kitchen_stock_barcodes')
      .select('barcode, item_id, brand, package_quantity, package_unit')
      .eq('organization_id', org.id),
  ])
  const items = stockItems ?? []
  const itemById = new Map(items.map(item => [item.id, item]))
  const barcodes = (barcodeRows ?? []).map((b: { barcode: string; item_id: string; brand: string | null; package_quantity: number | null; package_unit: string | null }) => ({
    barcode: b.barcode, itemId: b.item_id, brand: b.brand, packageQty: b.package_quantity ? Number(b.package_quantity) : null, packageUnit: b.package_unit,
  }))

  const handleRegisterBarcode = async (data: { barcode: string; itemId: string; brand: string; description: string; packageQty: number; packageUnit: string }) => {
    'use server'
    await registerBarcode({
      organizationId: org.id,
      itemId: data.itemId,
      barcode: data.barcode,
      brand: data.brand || null,
      description: data.description || null,
      packageQuantity: data.packageQty,
      packageUnit: data.packageUnit,
    })
  }
  const lowStockTotal = items.filter(item => Number(item.quantity ?? 0) <= Number(item.min_quantity ?? 0)).length
  const criticalLowTotal = items.filter(item => item.critical && Number(item.quantity ?? 0) <= Number(item.min_quantity ?? 0)).length
  const today = todayIso()
  const expiringLots = (lots ?? []).filter(lot => lot.expiration_date && lot.expiration_date <= new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().split('T')[0])

  const handleCreateStockItem = async (formData: FormData) => {
    'use server'
    const name = String(formData.get('name') ?? '').trim()
    if (!name) return
    const rawCode = String(formData.get('code') ?? '').trim()
    await createStockItem({
      organizationId: org.id,
      code: normalizeCode(rawCode || name),
      name,
      category: String(formData.get('category') ?? '').trim() || null,
      unit: String(formData.get('unit') ?? 'un').trim() || 'un',
      minQuantity: Number(formData.get('min_quantity') ?? 0),
      defaultLocation: String(formData.get('default_location') ?? '').trim() || null,
      critical: formData.get('critical') === 'on',
      notes: String(formData.get('notes') ?? '').trim() || null,
      barcode: String(formData.get('barcode') ?? '').trim() || null,
      createdBy: user.id,
    })
    redirect(`/${slug}/cozinha/estoque?tab=estoque&msg=estoque_criado`)
  }

  const handleCreateStockEntry = async (formData: FormData) => {
    'use server'
    await createStockEntry({
      organizationId: org.id,
      itemId: String(formData.get('item_id') ?? ''),
      sourceType: String(formData.get('source_type') ?? 'compra'),
      supplierName: String(formData.get('supplier_name') ?? '').trim() || null,
      lotCode: String(formData.get('lot_code') ?? '').trim() || null,
      expirationDate: String(formData.get('expiration_date') ?? '').trim() || null,
      quantity: Number(formData.get('quantity') ?? 0),
      unitCost: String(formData.get('unit_cost') ?? '').trim() ? Number(formData.get('unit_cost')) : null,
      receivedAt: String(formData.get('received_at') ?? todayIso()),
      location: String(formData.get('location') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
      createdBy: user.id,
    })
    redirect(`/${slug}/cozinha/estoque?tab=estoque&q=${encodeURIComponent(q)}&msg=entrada_criada`)
  }

  const handleCreateStockMovement = async (formData: FormData) => {
    'use server'
    await createStockMovement({
      organizationId: org.id,
      itemId: String(formData.get('item_id') ?? ''),
      movementType: String(formData.get('movement_type') ?? 'saida') as 'saida' | 'perda' | 'ajuste' | 'transferencia' | 'doacao_saida',
      quantity: Number(formData.get('quantity') ?? 0),
      locationFrom: String(formData.get('location_from') ?? '').trim() || null,
      locationTo: String(formData.get('location_to') ?? '').trim() || null,
      reason: String(formData.get('reason') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
      movementDate: String(formData.get('movement_date') ?? todayIso()),
      createdBy: user.id,
    })
    redirect(`/${slug}/cozinha/estoque?tab=estoque&q=${encodeURIComponent(q)}&msg=movimento_criado`)
  }

  const handleCreateStockSupplier = async (formData: FormData) => {
    'use server'
    await createStockSupplier({
      organizationId: org.id,
      name: String(formData.get('name') ?? '').trim(),
      description: optionalText(formData, 'description'),
      contactCountryCode: String(formData.get('contact_country_code') ?? 'BR'),
      contactPhone: optionalText(formData, 'contact_phone'),
      contactEmail: optionalText(formData, 'contact_email'),
      address: optionalText(formData, 'address'),
      cnpj: optionalText(formData, 'cnpj'),
      notes: optionalText(formData, 'notes'),
      createdBy: user.id,
    })
    redirect(`/${slug}/cozinha/estoque?tab=fornecedores&msg=fornecedor_criado`)
  }

  const handleUpdateStockSupplier = async (formData: FormData) => {
    'use server'
    await updateStockSupplier({
      id: String(formData.get('supplier_id') ?? ''),
      organizationId: org.id,
      name: String(formData.get('name') ?? '').trim(),
      description: optionalText(formData, 'description'),
      contactCountryCode: String(formData.get('contact_country_code') ?? 'BR'),
      contactPhone: optionalText(formData, 'contact_phone'),
      contactEmail: optionalText(formData, 'contact_email'),
      address: optionalText(formData, 'address'),
      cnpj: optionalText(formData, 'cnpj'),
      notes: optionalText(formData, 'notes'),
    })
    redirect(`/${slug}/cozinha/estoque?tab=fornecedores&msg=fornecedor_atualizado`)
  }

  const handleRemoveStockSupplier = async (formData: FormData) => {
    'use server'
    await removeStockSupplier({
      id: String(formData.get('supplier_id') ?? ''),
      organizationId: org.id,
    })
    redirect(`/${slug}/cozinha/estoque?tab=fornecedores&msg=fornecedor_removido`)
  }

  const msgInfo: Record<string, string> = {
    estoque_criado: 'Item cadastrado.',
    item_atualizado: 'Dados do item atualizados.',
    estoque_removido: 'Item removido do estoque ativo.',
    entrada_criada: 'Entrada registrada no estoque.',
    movimento_criado: 'Movimentação registrada.',
    fornecedor_criado: 'Fornecedor cadastrado.',
    fornecedor_atualizado: 'Fornecedor atualizado.',
    fornecedor_removido: 'Fornecedor removido da lista ativa.',
  }

  // Derived data
  const criticalItems = items.filter(item => item.critical && Number(item.quantity ?? 0) <= Number(item.min_quantity ?? 0))
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const expiring7 = (lots ?? []).filter(l => l.expiration_date && l.expiration_date <= in7days)
  const expiring30 = expiringLots.filter(l => l.expiration_date && l.expiration_date > in7days)

  // Group items by category for display
  const categories = [...new Set(items.map(i => i.category ?? 'Sem categoria'))].sort()

  return (
    <>
      <Header
        title="Estoque"
        actions={
          <Link href={`/${slug}/cozinha`} className="text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            &larr; Cozinha
          </Link>
        }
      />
      <main className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
        {msg && msgInfo[msg] && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {msgInfo[msg]}
          </div>
        )}

        {/* ── KPIs (clicáveis → modal) ──────────────────────────────── */}
        <StockKpiCards
          items={items.map(i => ({
            id: i.id, name: i.name, category: i.category ?? null, unit: i.unit,
            quantity: Number(i.quantity ?? 0), min_quantity: Number(i.min_quantity ?? 0),
            critical: Boolean(i.critical), default_location: i.default_location ?? null,
          }))}
          expiringLots={expiringLots.map(l => ({
            id: l.id, item_id: l.item_id, expiration_date: l.expiration_date ?? null,
            quantity_current: Number(l.quantity_current ?? 0),
            location: l.location ?? null, supplier_name: l.supplier_name ?? null,
            item_name: itemById.get(l.item_id)?.name ?? '—',
          }))}
          lowStockTotal={lowStockTotal}
          criticalLowTotal={criticalLowTotal}
        />

        {/* ── Alertas ───────────────────────────────────────────────── */}
        {(criticalItems.length > 0 || expiring7.length > 0) && (
          <section className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5"><AlertTriangle className="size-4" /> Atenção imediata</p>
            {criticalItems.map(i => (
              <p key={i.id} className="text-xs text-red-600">
                <span className="font-medium">{i.name}</span> — estoque crítico: {Number(i.quantity ?? 0).toLocaleString('pt-BR')} {i.unit} (mín: {Number(i.min_quantity ?? 0).toLocaleString('pt-BR')})
              </p>
            ))}
            {expiring7.map(l => (
              <p key={l.id} className="text-xs text-red-600">
                <span className="font-medium">{itemById.get(l.item_id)?.name ?? 'Item'}</span> — lote vence em {fmtDate(l.expiration_date)} ({Number(l.quantity_current ?? 0).toLocaleString('pt-BR')} restantes)
              </p>
            ))}
          </section>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <nav className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1.5">
          {[
            { key: 'estoque', label: `Itens (${items.length})` },
            { key: 'fornecedores', label: `Fornecedores (${suppliers?.length ?? 0})` },
          ].map(t => (
            <Link key={t.key} href={`/${slug}/cozinha/estoque?tab=${t.key}`}
              className={`flex-1 text-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {t.label}
            </Link>
          ))}
        </nav>

        {/* ════════════════════════ TAB ESTOQUE ════════════════════════ */}
        {activeTab === 'estoque' && (
          <div className="space-y-5">

            {/* ── Ações rápidas (cards → modais) ────────────────────── */}
            <EstoqueActions
              items={items.map(i => ({ id: i.id, name: i.name, unit: i.unit }))}
              barcodes={barcodes}
              today={today}
              entryAction={handleCreateStockEntry}
              movementAction={handleCreateStockMovement}
              itemAction={handleCreateStockItem}
              onRegisterBarcode={handleRegisterBarcode}
              itemsForBarcode={items.map(i => ({ id: i.id, name: i.name, code: i.code ?? i.name, unit: i.unit }))}
              barcodesForManager={barcodes.map(b => ({ ...b, description: null }))}
              sourceOptions={[['compra','Compra'],['doacao','Doação'],['outro','Outro']]}
              movementOptions={[['saida','Saída'],['perda','Perda'],['ajuste','Ajuste'],['transferencia','Transferência'],['doacao_saida','Doação']]}
            />

            {/* ── Busca ─────────────────────────────────────────────── */}
            <form action={`/${slug}/cozinha/estoque`} className="flex gap-2">
              <input type="hidden" name="tab" value="estoque" />
              <input name="q" defaultValue={q} placeholder="Buscar por nome, código ou barcode..."
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <button type="submit" className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors">
                Buscar
              </button>
              {q && (
                <Link href={`/${slug}/cozinha/estoque?tab=estoque`}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                  Limpar
                </Link>
              )}
            </form>

            {/* ── Lista de itens por categoria ───────────────────────── */}
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-gray-400 text-sm">{q ? 'Nenhum item encontrado.' : 'Nenhum item cadastrado ainda.'}</p>
              </div>
            ) : categories.map(cat => {
              const catItems = items.filter(i => (i.category ?? 'Sem categoria') === cat)
              if (!catItems.length) return null
              return (
                <section key={cat} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cat}</h3>
                    <span className="text-xs text-gray-400">{catItems.length} iten{catItems.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {catItems.map(item => {
                      const qty = Number(item.quantity ?? 0)
                      const minQty = Number(item.min_quantity ?? 0)
                      const isCriticalLow = item.critical && qty <= minQty
                      const isLow = !item.critical && minQty > 0 && qty <= minQty
                      const pct = minQty > 0 ? Math.min(100, Math.round((qty / minQty) * 100)) : 100
                      const itemLots = (lots ?? []).filter(l => l.item_id === item.id)
                      const itemBarcodes = barcodes.filter(b => b.itemId === item.id)

                      return (
                        <div key={item.id} className={`px-4 py-3 ${isCriticalLow ? 'bg-red-50' : isLow ? 'bg-yellow-50' : ''}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-semibold ${isCriticalLow ? 'text-red-800' : 'text-gray-900'}`}>{item.name}</span>
                                {item.critical && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">Crítico</span>}
                                {item.default_location && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{item.default_location}</span>}
                              </div>
                              {minQty > 0 && (
                                <div className="mt-1.5 flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-32">
                                    <div className={`h-full rounded-full ${isCriticalLow ? 'bg-red-500' : isLow ? 'bg-yellow-400' : 'bg-green-400'}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-400">mín {minQty.toLocaleString('pt-BR')} {item.unit}</span>
                                </div>
                              )}
                              {itemLots.length > 0 && (
                                <p className="mt-1 text-xs text-gray-400">
                                  {itemLots.length} lote{itemLots.length > 1 ? 's' : ''} ·{' '}
                                  {itemLots.some(l => l.expiration_date && l.expiration_date <= in7days) && <span className="text-red-500 font-medium">vence em breve</span>}
                                </p>
                              )}
                              {itemBarcodes.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {itemBarcodes.map(b => (
                                    <span key={b.barcode} className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded font-mono">
                                      {b.brand ? <span className="font-sans font-medium">{b.brand}</span> : null}
                                      {b.packageQty ? `${b.packageQty}${b.packageUnit ?? ''}` : b.barcode}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className={`text-lg font-bold ${isCriticalLow ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-gray-900'}`}>
                                {qty.toLocaleString('pt-BR')}
                              </p>
                              <p className="text-xs text-gray-400">{item.unit}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}

            {/* ── Lotes vencendo em 30 dias ──────────────────────────── */}
            {expiring30.length > 0 && (
              <section className="rounded-xl border border-yellow-200 bg-yellow-50 overflow-hidden">
                <div className="border-b border-yellow-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-yellow-800">Vencendo em 30 dias</h2>
                </div>
                <div className="divide-y divide-yellow-100">
                  {expiring30.map(l => (
                    <div key={l.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-yellow-900 truncate">{itemById.get(l.item_id)?.name ?? '—'}</p>
                        <p className="text-xs text-yellow-700">Vence: {fmtDate(l.expiration_date)}</p>
                      </div>
                      <span className="text-sm font-bold text-yellow-800 flex-shrink-0">{Number(l.quantity_current).toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Movimentações recentes ─────────────────────────────── */}
            {(movements?.length ?? 0) > 0 && (
              <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="border-b border-gray-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-gray-800">Movimentações recentes</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {movements!.map(move => {
                    const item = itemById.get(move.item_id)
                    const typeMap: Record<string, { label: string; color: string }> = {
                      entrada: { label: 'Entrada', color: 'text-green-600' },
                      saida: { label: 'Saída', color: 'text-gray-600' },
                      perda: { label: 'Perda', color: 'text-red-500' },
                      ajuste: { label: 'Ajuste', color: 'text-blue-500' },
                      transferencia: { label: 'Transferência', color: 'text-purple-500' },
                      doacao_saida: { label: 'Doação', color: 'text-orange-500' },
                    }
                    const t = typeMap[move.movement_type] ?? { label: move.movement_type, color: 'text-gray-600' }
                    return (
                      <div key={move.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 truncate">{item?.name ?? '—'}</p>
                          <p className="text-xs text-gray-400">{move.reason ?? t.label}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className={`text-sm font-semibold ${t.color}`}>{t.label} {Number(move.quantity).toLocaleString('pt-BR')} {item?.unit}</p>
                          <p className="text-xs text-gray-400">{fmtDate(move.movement_date)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ══════════════════════ TAB FORNECEDORES ══════════════════════ */}
        {activeTab === 'fornecedores' && (
          <div className="space-y-5">

            {/* Card → modal */}
            <FornecedorActions createAction={handleCreateStockSupplier} />

            {/* Busca */}
            <form action={`/${slug}/cozinha/estoque`} className="flex gap-2">
              <input type="hidden" name="tab" value="fornecedores" />
              <input name="q" defaultValue={activeTab === 'fornecedores' ? q : ''} placeholder="Buscar por nome, e-mail ou CNPJ..."
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <button type="submit" className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors">
                Buscar
              </button>
              {q && activeTab === 'fornecedores' && (
                <Link href={`/${slug}/cozinha/estoque?tab=fornecedores`}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                  Limpar
                </Link>
              )}
            </form>

            {/* Lista */}
            {(!suppliers || suppliers.length === 0) ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-gray-400 text-sm">{q && activeTab === 'fornecedores' ? 'Nenhum fornecedor encontrado.' : 'Nenhum fornecedor cadastrado.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suppliers.map(sup => (
                  <details key={sup.id} className="group rounded-xl border border-gray-200 bg-white overflow-hidden transition-all hover:border-brand-200 hover:shadow-sm">
                    <summary className="flex items-center justify-between gap-3 px-4 py-4 cursor-pointer list-none">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">{sup.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[sup.contact_phone, sup.contact_email, sup.address].filter(Boolean).join(' · ') || 'Sem dados de contato'}
                        </p>
                      </div>
                      <span className="text-xs text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">Editar &rarr;</span>
                    </summary>

                    {/* Edit form */}
                    <div className="border-t border-gray-100 bg-gray-50">
                      <form action={handleUpdateStockSupplier} className="grid gap-2 p-4 sm:grid-cols-2">
                        <input type="hidden" name="supplier_id" value={sup.id} />
                        <SbField name="name" label="Nome *" required defaultValue={sup.name} className="sm:col-span-2" />
                        <SbField name="description" label="Descrição" defaultValue={sup.description ?? ''} className="sm:col-span-2" />
                        <SbField name="contact_email" label="E-mail" type="email" defaultValue={sup.contact_email ?? ''} />
                        <SbField name="cnpj" label="CNPJ" defaultValue={sup.cnpj ?? ''} />
                        <div className="sm:col-span-2">
                          <span className="mb-1 block text-xs font-medium text-gray-600">Telefone</span>
                          <InternationalPhoneField
                            countryName="contact_country_code"
                            phoneName="contact_phone"
                            defaultCountryIso={sup.contact_country_code ?? 'BR'}
                            defaultPhone={sup.contact_phone ?? ''}
                          />
                        </div>
                        <SbField name="address" label="Endereço" defaultValue={sup.address ?? ''} className="sm:col-span-2" />
                        <SbField name="notes" label="Notas" defaultValue={sup.notes ?? ''} className="sm:col-span-2" />
                        <div className="sm:col-span-2 flex gap-2">
                          <button className="flex-1 rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors">
                            Salvar alterações
                          </button>
                          <form action={handleRemoveStockSupplier}>
                            <input type="hidden" name="supplier_id" value={sup.id} />
                            <button type="submit" className="rounded-lg border border-red-200 text-red-500 hover:bg-red-50 px-3 py-2 text-sm transition-colors">
                              Remover
                            </button>
                          </form>
                        </div>
                      </form>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </>
  )
}

// ── Helpers de UI ──────────────────────────────────────────────────────

import type { InputHTMLAttributes } from 'react'

function SbField({ label, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input {...props} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
    </label>
  )
}
