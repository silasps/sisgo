import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLaundryPaymentSettings, confirmLaundryPaymentAndStart } from '@/lib/laundry/payments'

type WebhookPayload = {
  event?: string
  payment?: {
    id?: string
    status?: string
    externalReference?: string
    external_reference?: string
  }
  data?: { id?: string }
  id?: string
  status?: string
}

const PAID_STATUSES = new Set([
  'received', 'confirmed', 'received_in_cash',
  'payment_received', 'payment_confirmed', 'pix_received', 'paid', 'approved',
])

// Webhook do Asaas para a lavanderia: confirma o pagamento e liga a máquina.
export async function POST(request: NextRequest) {
  const token = (request.headers.get('asaas-access-token') ?? request.headers.get('x-sisgo-webhook-token'))?.trim()
  if (!token) return NextResponse.json({ error: 'Token ausente.' }, { status: 401 })

  let payload: WebhookPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const externalReference = payload.payment?.externalReference ?? payload.payment?.external_reference
  const providerChargeId = payload.payment?.id ?? payload.data?.id ?? payload.id
  const status = String(payload.event ?? payload.payment?.status ?? payload.status ?? '').toLowerCase()

  const sb = createAdminClient()

  const select = 'id, organization_id, machine_id, duration_minutes, amount_paid, status, payment_status, guest_name'
  let session = null
  if (externalReference) {
    const { data } = await sb.from('laundry_sessions').select(select).eq('id', externalReference).maybeSingle()
    session = data
  }
  if (!session && providerChargeId) {
    const { data } = await sb.from('laundry_sessions').select(select).eq('provider_charge_id', providerChargeId).maybeSingle()
    session = data
  }
  if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })

  const settings = await getLaundryPaymentSettings(sb, session.organization_id)
  if (!settings?.webhook_token || settings.webhook_token !== token) {
    return NextResponse.json({ error: 'Webhook não autorizado.' }, { status: 403 })
  }

  if (!PAID_STATUSES.has(status)) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'Status não confirma pagamento.' })
  }

  if (session.status !== 'pending_payment') {
    return NextResponse.json({ ok: true, already_processed: true })
  }

  const result = await confirmLaundryPaymentAndStart(sb, session)
  return NextResponse.json({ ok: true, started: result.started, error: result.error ?? null })
}
