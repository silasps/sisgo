import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getRolePreview } from '@/lib/role-preview'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { confirmMealPayment, createMealConsumers, updateMealSettings } from './actions'
import { MealConsumerDateForm } from './MealConsumerDateForm'
import { MealSettingsEditor } from './MealSettingsEditor'
import { userHasAnyRole, MANAGEMENT_ROLES, KITCHEN_ROLES, GENERAL_FINANCE_ROLES } from '@/lib/auth/permissions'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ date?: string; meal?: string; msg?: string }>
}

type MealOption = { id: string; label: string; price: number }
type ComboRule = { id: string; name: string; mealIds: string[]; rewardMealIds?: string[]; discountPercent: number }

function normalizeMealOptions(settings: Record<string, unknown> | null): MealOption[] {
  if (Array.isArray(settings?.meal_options) && settings.meal_options.length > 0) {
    return settings.meal_options.flatMap(item => {
      if (!item || typeof item !== 'object') return []
      const meal = item as Partial<MealOption>
      if (!meal.id || !meal.label) return []
      return [{ id: meal.id, label: meal.label, price: Number(meal.price ?? 0) }]
    })
  }

  return [
    { id: 'breakfast', label: 'Café da manhã', price: Number(settings?.breakfast_price ?? 0) },
    { id: 'lunch', label: 'Almoço', price: Number(settings?.lunch_price ?? 0) },
    { id: 'dinner', label: 'Janta', price: Number(settings?.dinner_price ?? 0) },
  ]
}

function normalizeComboRules(settings: Record<string, unknown> | null): ComboRule[] {
  if (Array.isArray(settings?.combo_rules)) {
    return settings.combo_rules.flatMap(item => {
      if (!item || typeof item !== 'object') return []
      const combo = item as Partial<ComboRule>
      const mealIds = Array.isArray(combo.mealIds) ? combo.mealIds.filter(id => typeof id === 'string') : []
      const rewardMealIds = Array.isArray(combo.rewardMealIds) ? combo.rewardMealIds.filter(id => typeof id === 'string') : []
      if (!combo.id || mealIds.length < 2) return []
      return [{
        id: combo.id,
        name: typeof combo.name === 'string' && combo.name.trim() ? combo.name : 'Combo',
        mealIds,
        rewardMealIds,
        discountPercent: Number(combo.discountPercent ?? 0),
      }]
    })
  }

  const percent = Number(settings?.lunch_dinner_discount_percent ?? 0)
  return percent > 0 ? [{ id: 'lunch_dinner', name: 'Almoço + janta', mealIds: ['lunch', 'dinner'], discountPercent: percent }] : []
}

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function fmtDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
}

export default async function CozinhaPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { date = todayIso(), meal = 'all', msg } = await searchParams
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
  const allRoles = [role, ...(orgAccumulations[role] ?? []), ...extraRoles]
  const canView = userHasAnyRole(allRoles, KITCHEN_ROLES)
  const canManageMeals = userHasAnyRole(allRoles, GENERAL_FINANCE_ROLES)
  if (!canView) notFound()

  const sbAdmin = createAdminClient()
  const [{ data: consumers }, { data: pendingConsumers }, { data: mealSettings }] = await Promise.all([
    sbAdmin
      .from('kitchen_meal_consumers')
      .select('id, consumer_name, meal_date, breakfast, lunch, dinner, selected_meals, payment_type, notes')
      .eq('organization_id', org.id)
      .eq('payment_status', 'paid')
      .eq('meal_date', date)
      .order('consumer_name', { ascending: true }),
    sbAdmin
      .from('kitchen_meal_consumers')
      .select('purchase_group_id, consumer_name, meal_date, selected_meals, notes, final_amount, created_at')
      .eq('organization_id', org.id)
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: false }),
    sbAdmin.from('kitchen_meal_settings')
      .select('breakfast_price, lunch_price, dinner_price, combo_lunch_dinner_includes_breakfast, lunch_dinner_discount_percent, meal_options, combo_rules')
      .eq('organization_id', org.id)
      .maybeSingle(),
  ])
  const settings = (mealSettings ?? null) as Record<string, unknown> | null
  const mealOptions = normalizeMealOptions(settings)
  const comboRules = normalizeComboRules(settings)
  const selectedMeal = meal === 'all' || mealOptions.some(item => item.id === meal) ? meal : 'all'

  const allConsumerRows = (consumers ?? []) as Array<{
    id: string
    consumer_name: string
    meal_date: string
    breakfast: boolean
    lunch: boolean
    dinner: boolean
    selected_meals: string[] | null
    payment_type: string
    notes: string | null
  }>
  const consumerRows = selectedMeal === 'all'
    ? allConsumerRows
    : allConsumerRows.filter(row => {
      const selectedMeals = Array.isArray(row.selected_meals) && row.selected_meals.length > 0
        ? row.selected_meals
        : [
          row.breakfast ? 'breakfast' : null,
          row.lunch ? 'lunch' : null,
          row.dinner ? 'dinner' : null,
        ].filter(Boolean)
      return selectedMeals.includes(selectedMeal)
    })

  const mealTotals = mealOptions.map(option => ({
    ...option,
    total: consumerRows.filter(row => {
      const selectedMeals = Array.isArray(row.selected_meals) && row.selected_meals.length > 0
        ? row.selected_meals
        : [
          row.breakfast ? 'breakfast' : null,
          row.lunch ? 'lunch' : null,
          row.dinner ? 'dinner' : null,
        ].filter(Boolean)
      return selectedMeals.includes(option.id)
    }).length,
  }))
  const visibleConsumerTotal = consumerRows.length
  const mealPortionTotal = selectedMeal === 'all'
    ? mealTotals.reduce((sum, item) => sum + item.total, 0)
    : visibleConsumerTotal
  const visibleMealOptions = mealTotals.filter(item => item.total > 0)
  const pendingOrders = Object.values(((pendingConsumers ?? []) as Array<{
    purchase_group_id: string
    consumer_name: string
    meal_date: string
    selected_meals: string[] | null
    notes: string | null
    final_amount: number | null
    created_at: string
  }>).reduce<Record<string, {
    purchase_group_id: string
    consumer_name: string
    dates: string[]
    meals: string[]
    notes: string | null
    total: number
  }>>((acc, row) => {
    const current = acc[row.purchase_group_id] ?? {
      purchase_group_id: row.purchase_group_id,
      consumer_name: row.consumer_name,
      dates: [],
      meals: [],
      notes: row.notes,
      total: 0,
    }
    current.dates.push(row.meal_date)
    current.meals.push(...(Array.isArray(row.selected_meals) ? row.selected_meals : []))
    current.total += Number(row.final_amount ?? 0)
    acc[row.purchase_group_id] = current
    return acc
  }, {}))

  const handleCreateMealConsumer = async (formData: FormData) => {
    'use server'
    const consumerName = String(formData.get('consumer_name') ?? '').trim()
    const mealItems = JSON.parse(String(formData.get('meal_cart') ?? '[]')) as Array<{
      date: string
      purchasedMealIds: string[]
      servedMealIds: string[]
      subtotal: number
      discount: number
      finalAmount: number
    }>
    if (!consumerName || mealItems.length === 0) return
    const subtotal = mealItems.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0)
    const automaticDiscount = mealItems.reduce((sum, item) => sum + Number(item.discount ?? 0), 0)
    const totalDiscount = Math.max(0, Number(formData.get('discount_amount') ?? automaticDiscount))
    const manualDiscount = Math.max(0, totalDiscount - automaticDiscount)
    const finalAmount = Math.max(0, subtotal - totalDiscount)

    await createMealConsumers({
      organizationId: org.id,
      consumerName,
      mealItems,
      manualDiscountAmount: manualDiscount,
      finalAmount,
      notes: String(formData.get('notes') ?? '').trim() || null,
      createdBy: user.id,
      requestedBy: user.id,
      paymentStatus: 'paid',
      purchaseSource: 'secretaria',
      createFinancialEntry: true,
    })
    redirect(`/${slug}/cozinha?date=${mealItems[0].date}&meal=${meal}&msg=consumidor_criado`)
  }

  const handleUpdateMealSettings = async (formData: FormData) => {
    'use server'
    await updateMealSettings({
      organizationId: org.id,
      breakfastPrice: Number(formData.get('breakfast_price') ?? 0),
      lunchPrice: Number(formData.get('lunch_price') ?? 0),
      dinnerPrice: Number(formData.get('dinner_price') ?? 0),
      comboLunchDinnerIncludesBreakfast: formData.get('combo_lunch_dinner_includes_breakfast') === 'on',
      lunchDinnerDiscountPercent: Math.max(0, Number(formData.get('lunch_dinner_discount_percent') ?? 0)),
      mealOptions: JSON.parse(String(formData.get('meal_options') ?? '[]')),
      comboRules: JSON.parse(String(formData.get('combo_rules') ?? '[]')),
      updatedBy: user.id,
    })
    redirect(`/${slug}/cozinha?date=${date}&meal=${meal}&msg=precos_atualizados`)
  }

  const handleConfirmPayment = async (formData: FormData) => {
    'use server'
    await confirmMealPayment({
      organizationId: org.id,
      purchaseGroupId: String(formData.get('purchase_group_id') ?? ''),
      confirmedBy: user.id,
    })
    redirect(`/${slug}/cozinha?date=${date}&meal=${meal}&msg=pagamento_confirmado`)
  }

  const msgInfo: Record<string, string> = {
    consumidor_criado: 'Consumidor adicionado à lista.',
    pagamento_confirmado: 'Pagamento confirmado. Pedido liberado para a cozinha e financeiro.',
    precos_atualizados: 'Valores e combos atualizados.',
  }

  return (
    <>
      <Header title="Cozinha" />
      <main className="p-4 md:p-6 space-y-6 overflow-y-auto flex-1">
        {msg && msgInfo[msg] && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {msgInfo[msg]}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">Operação da cozinha</p>
            <p className="text-xs text-gray-400">Lista diária de consumidores e preparo das refeições.</p>
          </div>
          <Link href={`/${slug}/cozinha/estoque`} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Abrir estoque
          </Link>
        </div>

        <form className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-end" action={`/${slug}/cozinha`}>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dia</label>
            <input name="date" type="date" defaultValue={date}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Refeição</label>
            <select name="meal" defaultValue={selectedMeal}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="all">Todas</option>
              {mealOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            Filtrar
          </button>
        </form>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Consumidores" value={visibleConsumerTotal} />
          <MetricCard label="Porções" value={mealPortionTotal} />
          {mealTotals.slice(0, 3).map(item => (
            <MetricCard key={item.id} label={item.label} value={item.total} />
          ))}
        </div>

        {canManageMeals && (
          <MealSettingsEditor action={handleUpdateMealSettings} mealOptions={mealOptions} comboRules={comboRules} />
        )}

        {canManageMeals && pendingOrders.length > 0 && (
          <section className="rounded-xl border border-yellow-200 bg-yellow-50 overflow-hidden">
            <div className="border-b border-yellow-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-yellow-900">Refeições aguardando pagamento</h2>
              <p className="text-xs text-yellow-700">Confirme apenas depois de validar o pagamento. Após confirmar, entra na lista da cozinha e no financeiro.</p>
            </div>
            <div className="divide-y divide-yellow-100">
              {pendingOrders.map(order => (
                <div key={order.purchase_group_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{order.consumer_name}</p>
                    <p className="text-xs text-gray-600">
                      {order.dates.length} dia{order.dates.length === 1 ? '' : 's'} · {[...new Set(order.meals)].map(mealId => mealOptions.find(item => item.id === mealId)?.label ?? mealId).join(', ')}
                    </p>
                    {order.notes && <p className="mt-1 text-xs text-gray-500">{order.notes}</p>}
                  </div>
                  <form action={handleConfirmPayment}>
                    <input type="hidden" name="purchase_group_id" value={order.purchase_group_id} />
                    <button className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600">
                      Confirmar pagamento
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Lista de consumidores</h2>
              <p className="text-xs text-gray-400">{fmtDate(date)}</p>
            </div>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              {visibleConsumerTotal} pessoa{visibleConsumerTotal === 1 ? '' : 's'}
            </span>
          </div>

          {canManageMeals && (
            <MealConsumerDateForm
              action={handleCreateMealConsumer}
              defaultDate={date}
              mealOptions={mealOptions}
              comboRules={comboRules}
            />
          )}

          {consumerRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Nenhum consumidor para este filtro.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    {visibleMealOptions.map(option => (
                      <th key={option.id} className="px-4 py-3 text-center">{option.label}</th>
                    ))}
                    <th className="px-4 py-3">Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {consumerRows.map(row => {
                    const selectedMeals = Array.isArray(row.selected_meals) && row.selected_meals.length > 0
                      ? row.selected_meals
                      : [
                        row.breakfast ? 'breakfast' : null,
                        row.lunch ? 'lunch' : null,
                        row.dinner ? 'dinner' : null,
                      ].filter(Boolean)

                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.consumer_name}</td>
                        {visibleMealOptions.map(option => (
                          <td key={option.id} className="px-4 py-3 text-center">
                            {selectedMeals.includes(option.id) ? 'Sim' : '-'}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-gray-500">{row.notes ?? '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </main>
    </>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-3xl font-bold text-gray-900">{value.toLocaleString('pt-BR')}</p>
      <p className="mt-1 text-xs font-semibold uppercase text-gray-500">{label}</p>
    </div>
  )
}
