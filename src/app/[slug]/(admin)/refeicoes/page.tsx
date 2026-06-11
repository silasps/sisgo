import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import { getRolePreview } from '@/lib/role-preview'
import { createMealConsumers, uploadMealPaymentProof } from '../cozinha/actions'
import { MealConsumerDateForm } from '../cozinha/MealConsumerDateForm'
import { MealPaymentProofForm } from './MealPaymentProofForm'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ msg?: string; pedido?: string }>
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

export default async function RefeicoesPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { msg, pedido } = await searchParams
  const supabase = await createClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)

  const rows = (orgUsers ?? []) as unknown as Array<{
    organization_id: string | null
    roles: { name: string } | null
  }>
  const superadminRow = rows.find(row => row.roles?.name === 'superadmin')
  const currentOrgRow = rows.find(row => row.organization_id === org.id)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  const preview = await getRolePreview(realRole)
  const role = preview?.role ?? realRole
  if (realRole !== 'superadmin' && !currentOrgRow) notFound()
  if (!role) notFound()

  const sbAdmin = createAdminClient()
  const [{ data: mealSettings }, { data: pendingRows }, { data: chargeRows }, { data: rejectedRows }] = await Promise.all([
    sbAdmin.from('kitchen_meal_settings')
      .select('breakfast_price, lunch_price, dinner_price, lunch_dinner_discount_percent, meal_options, combo_rules, payment_mode, payment_methods, payment_instructions, payment_provider, payment_provider_settings')
      .eq('organization_id', org.id)
      .maybeSingle(),
    sbAdmin.from('kitchen_meal_consumers')
      .select('purchase_group_id, meal_date, selected_meals, final_amount, payment_status, notes, created_at, payment_proof_name, payment_proof_uploaded_at, payment_proof_requested_at, payment_proof_request_message')
      .eq('organization_id', org.id)
      .eq('requested_by', user.id)
      .in('payment_status', ['pending', 'paid'])
      .order('meal_date', { ascending: false })
      .limit(80),
    sbAdmin.from('kitchen_meal_payment_charges')
      .select('purchase_group_id, status, pix_copy_paste, pix_qr_code_base64, invoice_url, expires_at, raw_response')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(50),
    sbAdmin.from('kitchen_meal_consumers')
      .select('purchase_group_id, meal_date, selected_meals, final_amount, payment_rejection_reason, payment_rejected_at')
      .eq('organization_id', org.id)
      .eq('requested_by', user.id)
      .eq('payment_status', 'rejected')
      .order('payment_rejected_at', { ascending: false })
      .limit(40),
  ])
  const settings = (mealSettings ?? null) as Record<string, unknown> | null
  const mealOptions = normalizeMealOptions(settings)
  const comboRules = normalizeComboRules(settings)
  const rawPaymentMethods = Array.isArray(settings?.payment_methods) ? settings.payment_methods : [settings?.payment_mode ?? 'manual']
  const storedPaymentMethods = rawPaymentMethods.filter((method): method is string => typeof method === 'string')
  const providerSettings = (
    settings?.payment_provider_settings
    && typeof settings.payment_provider_settings === 'object'
    && !Array.isArray(settings.payment_provider_settings)
  )
    ? settings.payment_provider_settings as Record<string, unknown>
    : {}
  const paymentProvider = typeof settings?.payment_provider === 'string' ? settings.payment_provider : ''
  const gatewayConfigured = Boolean(['asaas', 'mercado_pago', 'pagseguro'].includes(paymentProvider) && providerSettings.gateway_configured === true)
  const gatewayRequested = storedPaymentMethods.includes('gateway') || providerSettings.gateway_requested === true
  const paymentMethods = storedPaymentMethods.filter(method => method !== 'gateway' || gatewayConfigured)
  const paymentInstructions = typeof settings?.payment_instructions === 'string' ? settings.payment_instructions : ''
  const consumerName = (user.user_metadata?.full_name as string | undefined)
    || (user.user_metadata?.name as string | undefined)
    || user.email
    || 'Usuário'

  const handleCreateSelfOrder = async (formData: FormData) => {
    'use server'
    const mealItems = JSON.parse(String(formData.get('meal_cart') ?? '[]')) as Array<{
      date: string
      purchasedMealIds: string[]
      servedMealIds: string[]
      subtotal: number
      discount: number
      finalAmount: number
    }>
    if (mealItems.length === 0) return
    const finalAmount = Math.max(0, mealItems.reduce((sum, item) => sum + Number(item.finalAmount ?? 0), 0))

    const order = await createMealConsumers({
      organizationId: org.id,
      consumerName,
      mealItems,
      manualDiscountAmount: 0,
      finalAmount,
      notes: String(formData.get('notes') ?? '').trim() || null,
      createdBy: user.id,
      requestedBy: user.id,
      paymentStatus: 'pending',
      purchaseSource: 'self_service',
      createFinancialEntry: false,
    })
    redirect(`/${slug}/refeicoes?msg=pedido_criado&pedido=${order?.purchaseGroupId ?? ''}`)
  }

  const handleUploadProof = async (formData: FormData) => {
    'use server'
    const purchaseGroupId = String(formData.get('purchase_group_id') ?? '')
    const file = formData.get('payment_proof')
    if (!purchaseGroupId || !(file instanceof File)) return
    await uploadMealPaymentProof({
      organizationId: org.id,
      purchaseGroupId,
      file,
      uploadedBy: user.id,
    })
    redirect(`/${slug}/refeicoes?msg=comprovante_enviado&pedido=${purchaseGroupId}`)
  }

  const msgInfo: Record<string, string> = {
    pedido_criado: 'Pedido criado e aguardando confirmação de pagamento.',
    comprovante_enviado: 'Comprovante enviado. A secretaria fará a conferência do pagamento.',
  }
  const fmt = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const chargesByPurchase = new Map((chargeRows ?? []).map(charge => [String(charge.purchase_group_id), charge]))
  type MealOrderRow = {
    purchase_group_id: string
    meal_date: string
    selected_meals: string[] | null
    final_amount: number | null
    payment_status: string | null
    notes: string | null
    created_at: string
    payment_proof_name: string | null
    payment_proof_uploaded_at: string | null
    payment_proof_requested_at: string | null
    payment_proof_request_message: string | null
  }
  const recentOrders = Object.values(((pendingRows ?? []) as MealOrderRow[]).reduce<Record<string, {
    purchase_group_id: string
    dates: string[]
    mealIds: string[]
    total: number
    status: string
    notes: string | null
    createdAt: string
    latestMealDate: string
    proofName: string | null
    proofUploadedAt: string | null
    proofRequestedAt: string | null
    proofRequestMessage: string | null
  }>>((acc, row) => {
    const key = String(row.purchase_group_id)
    const current = acc[key] ?? {
      purchase_group_id: key,
      dates: [],
      mealIds: [],
      total: 0,
      status: 'paid',
      notes: row.notes,
      createdAt: row.created_at,
      latestMealDate: row.meal_date,
      proofName: row.payment_proof_name,
      proofUploadedAt: row.payment_proof_uploaded_at,
      proofRequestedAt: row.payment_proof_requested_at,
      proofRequestMessage: row.payment_proof_request_message,
    }
    current.dates.push(row.meal_date)
    current.mealIds.push(...(Array.isArray(row.selected_meals) ? row.selected_meals : []))
    current.total += Number(row.final_amount ?? 0)
    current.status = current.status === 'paid' && row.payment_status === 'paid' ? 'paid' : 'pending'
    current.notes = current.notes ?? row.notes
    current.createdAt = new Date(row.created_at) > new Date(current.createdAt) ? row.created_at : current.createdAt
    current.latestMealDate = row.meal_date > current.latestMealDate ? row.meal_date : current.latestMealDate
    current.proofName = current.proofName ?? row.payment_proof_name
    current.proofUploadedAt = latestDate(current.proofUploadedAt, row.payment_proof_uploaded_at)
    current.proofRequestedAt = latestDate(current.proofRequestedAt, row.payment_proof_requested_at)
    current.proofRequestMessage = row.payment_proof_request_message ?? current.proofRequestMessage
    acc[key] = current
    return acc
  }, {})).sort((a, b) => {
    const aAttention = needsProofAttention(a.proofRequestedAt, a.proofUploadedAt)
    const bAttention = needsProofAttention(b.proofRequestedAt, b.proofUploadedAt)
    if (aAttention !== bAttention) return aAttention ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  const proofAttentionOrders = recentOrders.filter(order => needsProofAttention(order.proofRequestedAt, order.proofUploadedAt))
  type RejectedMealOrderRow = {
    purchase_group_id: string
    meal_date: string
    selected_meals: string[] | null
    final_amount: number | null
    payment_rejection_reason: string | null
    payment_rejected_at: string | null
  }
  const rejectedOrders = Object.values(((rejectedRows ?? []) as RejectedMealOrderRow[]).reduce<Record<string, {
    purchase_group_id: string
    dates: string[]
    mealIds: string[]
    total: number
    reason: string | null
    rejectedAt: string | null
  }>>((acc, row) => {
    const key = String(row.purchase_group_id)
    const current = acc[key] ?? {
      purchase_group_id: key,
      dates: [],
      mealIds: [],
      total: 0,
      reason: row.payment_rejection_reason,
      rejectedAt: row.payment_rejected_at,
    }
    current.dates.push(row.meal_date)
    current.mealIds.push(...(Array.isArray(row.selected_meals) ? row.selected_meals : []))
    current.total += Number(row.final_amount ?? 0)
    current.reason = current.reason ?? row.payment_rejection_reason
    current.rejectedAt = latestDate(current.rejectedAt, row.payment_rejected_at)
    acc[key] = current
    return acc
  }, {})).sort((a, b) => new Date(b.rejectedAt ?? 0).getTime() - new Date(a.rejectedAt ?? 0).getTime())

  return (
    <>
      <Header title="Minhas refeições" />
      <main className="p-4 md:p-6 space-y-6 overflow-y-auto flex-1">
        {msg && msgInfo[msg] && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {msgInfo[msg]}
          </div>
        )}

        {proofAttentionOrders.length > 0 && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
            <div className="border-b border-amber-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-amber-950">Comprovante solicitado pela Secretaria</h2>
              <p className="text-xs text-amber-800">Resolva esta pendência antes de fazer uma nova compra.</p>
            </div>
            <div className="divide-y divide-amber-200">
              {proofAttentionOrders.map(order => (
                <div key={order.purchase_group_id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Pedido {String(order.purchase_group_id).slice(0, 8)}</p>
                      <p className="text-xs text-gray-600">
                        {formatOrderDates(order.dates)} · {[...new Set(order.mealIds)].map(mealId => mealOptions.find(item => item.id === mealId)?.label ?? mealId).join(', ')}
                      </p>
                      <p className="mt-1 text-sm font-bold text-gray-900">Total da compra: {fmt(order.total)}</p>
                      <p className="mt-2 text-xs text-amber-900">
                        {order.proofRequestMessage
                          ?? 'Houve um problema com a confirmação de pagamento da sua refeição. Por favor, coloque o comprovante aqui ou dirija-se à Secretaria. Obrigado.'}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      Pendente
                    </span>
                  </div>
                  <MealPaymentProofForm
                    action={handleUploadProof}
                    purchaseGroupId={order.purchase_group_id}
                    highlighted
                    proofName={order.proofName}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Comprar refeições</h2>
            <p className="text-xs text-gray-400">Depois de solicitar, o pedido fica aguardando confirmação de pagamento pela secretaria.</p>
          </div>
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <p className="font-semibold text-gray-800">Métodos aceitos pela base</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {paymentMethods.includes('manual') && <PaymentPill label="Manual pela secretaria" />}
              {paymentMethods.includes('proof') && <PaymentPill label="Com comprovante" />}
              {paymentMethods.includes('gateway') && <PaymentPill label="Pix automático" />}
            </div>
            {paymentInstructions && <p className="mt-1 text-xs text-gray-500">{paymentInstructions}</p>}
            {gatewayRequested && !gatewayConfigured && (
              <p className="mt-1 text-xs text-yellow-700">Pix automático ainda não está liberado; a secretaria fará a conferência do pagamento.</p>
            )}
          </div>
          <MealConsumerDateForm
            action={handleCreateSelfOrder}
            defaultDate={todayIso()}
            mealOptions={mealOptions}
            comboRules={comboRules}
            defaultConsumerName={consumerName}
            lockConsumerName
            showManualDiscount={false}
            submitLabel="Solicitar refeições"
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Meus pedidos recentes</h2>
          </div>
          {!recentOrders.length ? (
            <div className="p-8 text-center text-sm text-gray-400">Nenhum pedido registrado.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentOrders.map(order => {
                const proofNeedsAttention = needsProofAttention(order.proofRequestedAt, order.proofUploadedAt)
                return (
                <div key={order.purchase_group_id} className="px-4 py-3">
                  {proofNeedsAttention && (
                    <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <p className="font-semibold">Comprovante solicitado pela Secretaria</p>
                      <p className="mt-1">
                        {order.proofRequestMessage
                          ?? 'Houve um problema com a confirmação de pagamento da sua refeição. Por favor, coloque o comprovante aqui ou dirija-se à Secretaria. Obrigado.'}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        Pedido {String(order.purchase_group_id).slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatOrderDates(order.dates)} · {[...new Set(order.mealIds)].map(mealId => mealOptions.find(item => item.id === mealId)?.label ?? mealId).join(', ')}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Total da compra: {fmt(order.total)}
                      </p>
                      {order.notes && <p className="mt-1 text-xs text-gray-400">Observação: {order.notes}</p>}
                    </div>
                    <span className={order.status === 'paid'
                      ? 'rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700'
                      : 'rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-700'}>
                      {order.status === 'paid' ? 'Confirmado' : 'Aguardando pagamento'}
                    </span>
                  </div>
                  {pedido === order.purchase_group_id && (
                    <PaymentChargeBox charge={chargesByPurchase.get(String(order.purchase_group_id))} />
                  )}
                  {order.status !== 'paid' && (
                    <MealPaymentProofForm
                      action={handleUploadProof}
                      purchaseGroupId={order.purchase_group_id}
                      highlighted={proofNeedsAttention}
                      proofName={order.proofName}
                    />
                  )}
                </div>
              )})}
            </div>
          )}
        </section>

        {rejectedOrders.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-800">Histórico de pagamentos recusados</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {rejectedOrders.map(order => (
                <div key={order.purchase_group_id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-800">Pedido {order.purchase_group_id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">
                        {formatOrderDates(order.dates)} · {[...new Set(order.mealIds)].map(mealId => mealOptions.find(item => item.id === mealId)?.label ?? mealId).join(', ')}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">Total da compra: {fmt(order.total)}</p>
                      {order.reason && <p className="mt-1 text-xs text-red-700">Observação da Secretaria: {order.reason}</p>}
                    </div>
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                      Recusado
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}

function latestDate(a: string | null, b: string | null) {
  if (!a) return b
  if (!b) return a
  return new Date(b) > new Date(a) ? b : a
}

function needsProofAttention(requestedAt: string | null, uploadedAt: string | null) {
  return Boolean(requestedAt && (!uploadedAt || new Date(requestedAt) > new Date(uploadedAt)))
}

function formatOrderDates(dates: string[]) {
  const unique = [...new Set(dates)].sort()
  if (unique.length === 0) return 'Sem data'
  if (unique.length === 1) return new Date(`${unique[0]}T00:00:00`).toLocaleDateString('pt-BR')
  return `${new Date(`${unique[0]}T00:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${unique[unique.length - 1]}T00:00:00`).toLocaleDateString('pt-BR')}`
}

function PaymentPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700">
      {label}
    </span>
  )
}

function PaymentChargeBox({ charge }: { charge: {
  status: string
  pix_copy_paste: string | null
  pix_qr_code_base64: string | null
  invoice_url: string | null
  expires_at: string | null
  raw_response: unknown
} | undefined }) {
  if (!charge) {
    return (
      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
        A cobrança automática ainda não foi gerada. A secretaria poderá confirmar o pagamento manualmente.
      </div>
    )
  }

  if (charge.status === 'failed') {
    const raw = charge.raw_response && typeof charge.raw_response === 'object' ? charge.raw_response as { error?: string } : {}
    return (
      <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-700">
        Não foi possível gerar o Pix automático. {raw.error ?? 'A secretaria poderá conferir este pedido manualmente.'}
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3">
      <p className="text-xs font-semibold text-green-800">Pix gerado para este pedido</p>
      <div className="mt-3 grid gap-3 md:grid-cols-[8rem_1fr]">
        {charge.pix_qr_code_base64 && (
          <Image
            src={`data:image/png;base64,${charge.pix_qr_code_base64}`}
            alt="QR Code Pix"
            width={128}
            height={128}
            unoptimized
            className="h-32 w-32 rounded-lg border border-green-100 bg-white object-contain p-2"
          />
        )}
        <div className="space-y-2">
          {charge.pix_copy_paste && (
            <textarea
              readOnly
              value={charge.pix_copy_paste}
              className="h-24 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-gray-700"
            />
          )}
          {charge.invoice_url && (
            <a href={charge.invoice_url} target="_blank" rel="noreferrer"
              className="inline-flex rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800">
              Abrir cobrança
            </a>
          )}
          {charge.expires_at && (
            <p className="text-xs text-green-700">
              Válido até {new Date(charge.expires_at).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
