import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type PaymentWebhookPayload = {
  organization_id?: string
  organizationId?: string
  purchase_group_id?: string
  purchaseGroupId?: string
  reference_id?: string
  external_reference?: string
  status?: string
  payment_status?: string
  event?: string
  action?: string
  type?: string
  data?: {
    id?: string
  }
  id?: string
  payment?: {
    id?: string
    status?: string
    externalReference?: string
    external_reference?: string
  }
}

const PAID_STATUSES = new Set([
  'paid',
  'approved',
  'confirmed',
  'received',
  'concluded',
  'payment_received',
  'pix_received',
  'checkout.order.approved',
])

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-sisgo-webhook-token')?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Token ausente.' }, { status: 401 })
  }

  let payload: PaymentWebhookPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  let organizationId = payload.organization_id ?? payload.organizationId
  let purchaseGroupId = payload.purchase_group_id
    ?? payload.purchaseGroupId
    ?? payload.reference_id
    ?? payload.external_reference
    ?? payload.payment?.externalReference
    ?? payload.payment?.external_reference
  const providerChargeId = payload.payment?.id ?? payload.data?.id ?? payload.id
  const status = String(payload.payment_status ?? payload.status ?? payload.payment?.status ?? payload.event ?? payload.action ?? payload.type ?? '').toLowerCase()

  if (!organizationId && providerChargeId) {
    const sb = createAdminClient()
    const { data: charge } = await sb
      .from('kitchen_meal_payment_charges')
      .select('organization_id, purchase_group_id')
      .eq('provider_charge_id', providerChargeId)
      .maybeSingle()
    organizationId = charge?.organization_id
    purchaseGroupId = purchaseGroupId ?? charge?.purchase_group_id
  }

  if (!organizationId || !purchaseGroupId) {
    return NextResponse.json({ error: 'organization_id e purchase_group_id são obrigatórios.' }, { status: 400 })
  }
  if (!PAID_STATUSES.has(status)) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'Status não confirma pagamento.' })
  }

  const sb = createAdminClient()
  const { data: settings, error: settingsError } = await sb
    .from('kitchen_meal_settings')
    .select('payment_provider_settings')
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 })
  }

  const providerSettings = (
    settings?.payment_provider_settings
    && typeof settings.payment_provider_settings === 'object'
    && !Array.isArray(settings.payment_provider_settings)
  )
    ? settings.payment_provider_settings as Record<string, unknown>
    : {}

  if (providerSettings.webhook_token !== token || providerSettings.gateway_configured !== true) {
    return NextResponse.json({ error: 'Webhook não autorizado ou gateway inativo.' }, { status: 403 })
  }

  const { data: rows, error: rowsError } = await sb
    .from('kitchen_meal_consumers')
    .select('consumer_name, meal_date, final_amount')
    .eq('organization_id', organizationId)
    .eq('purchase_group_id', purchaseGroupId)
    .eq('payment_status', 'pending')
  if (rowsError) {
    return NextResponse.json({ error: rowsError.message }, { status: 500 })
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, already_processed: true })
  }

  const now = new Date().toISOString()
  const { error: updateError } = await sb
    .from('kitchen_meal_consumers')
    .update({
      payment_status: 'paid',
      paid_at: now,
      updated_at: now,
    })
    .eq('organization_id', organizationId)
    .eq('purchase_group_id', purchaseGroupId)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await sb
    .from('kitchen_meal_payment_charges')
    .update({
      status: 'paid',
      raw_response: payload,
      updated_at: now,
    })
    .eq('organization_id', organizationId)
    .eq('purchase_group_id', purchaseGroupId)

  const total = rows.reduce((sum, row) => sum + Number(row.final_amount ?? 0), 0)
  const first = rows[0]
  const { error: financialError } = await sb.from('financial_transactions').insert({
    organization_id: organizationId,
    description: `Refeições - ${first.consumer_name}`,
    amount: total,
    type: 'income',
    category: 'Cozinha',
    date: first.meal_date,
    status: 'paid',
  })
  if (financialError) {
    return NextResponse.json({ error: financialError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, purchase_group_id: purchaseGroupId })
}
