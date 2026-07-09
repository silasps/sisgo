import type { SupabaseClient } from '@supabase/supabase-js'
import { createAsaasPixCharge } from '@/lib/payments/asaas'
import { controlMachineDevice } from './control'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>

export type LaundryPaymentSettings = {
  organization_id: string
  provider: string
  environment: 'sandbox' | 'production'
  access_token: string | null
  default_customer_id: string | null
  webhook_token: string | null
  pix_key: string | null
  public_payments_enabled: boolean
}

export async function getLaundryPaymentSettings(sb: AnySupabase, organizationId: string): Promise<LaundryPaymentSettings | null> {
  const { data } = await sb.from('laundry_payment_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle()
  return (data as LaundryPaymentSettings | null) ?? null
}

export function paymentsConfigured(s: LaundryPaymentSettings | null): boolean {
  return !!(s && s.public_payments_enabled && s.access_token && s.default_customer_id)
}

function saoPauloToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export async function createLaundrySessionCharge(sb: AnySupabase, args: {
  settings: LaundryPaymentSettings
  organizationId: string
  sessionId: string
  machineName: string
  durationMinutes: number
  amountCents: number
}) {
  const charge = await createAsaasPixCharge({
    accessToken: args.settings.access_token!,
    environment: args.settings.environment,
    customerId: args.settings.default_customer_id!,
    amount: args.amountCents / 100,
    dueDate: saoPauloToday(),
    description: `Lavanderia — ${args.machineName} (${args.durationMinutes} min)`,
    externalReference: args.sessionId,
  })

  const { error } = await sb.from('laundry_sessions').update({
    provider_charge_id: charge.providerChargeId,
    payment_reference:  charge.providerChargeId,
    pix_copy_paste:     charge.pixCopyPaste,
    pix_qr_base64:      charge.pixQrCodeBase64,
  }).eq('id', args.sessionId).eq('organization_id', args.organizationId)
  if (error) throw new Error(error.message)

  return charge
}

// Consulta o status da cobrança direto no Asaas (fallback quando o webhook
// ainda não chegou — também é o que faz o fluxo funcionar em localhost).
export async function isAsaasChargePaid(settings: LaundryPaymentSettings, providerChargeId: string): Promise<boolean> {
  const baseUrl = settings.environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3'
  try {
    const res = await fetch(`${baseUrl}/payments/${providerChargeId}`, {
      headers: { accept: 'application/json', access_token: settings.access_token!, 'user-agent': 'SISGO/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return false
    const payment = await res.json() as { status?: string }
    return ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(String(payment.status ?? ''))
  } catch {
    return false
  }
}

type SessionRow = {
  id: string
  organization_id: string
  machine_id: string
  duration_minutes: number
  amount_paid: number
  status: string
  payment_status: string
  guest_name: string | null
}

// Confirma o pagamento e liga a máquina. Idempotente: pode ser chamada pelo
// webhook e pelo polling ao mesmo tempo sem ligar a máquina duas vezes —
// o update condicional de payment_status funciona como lock.
export async function confirmLaundryPaymentAndStart(sb: AnySupabase, session: SessionRow): Promise<{ started: boolean; error?: string }> {
  const now = new Date()

  if (session.payment_status === 'pending') {
    const { data: locked, error } = await sb.from('laundry_sessions')
      .update({ payment_status: 'paid' })
      .eq('id', session.id)
      .eq('payment_status', 'pending')
      .select('id')
    if (error) return { started: false, error: error.message }
    if (!locked || locked.length === 0) {
      // outra chamada confirmou primeiro; ela cuida de ligar a máquina
      return { started: false }
    }

    await sb.from('financial_transactions').insert({
      organization_id: session.organization_id,
      description: `Lavanderia — ${session.guest_name || 'pagamento PIX'}`,
      amount: session.amount_paid / 100,
      type: 'income',
      category: 'Lavanderia',
      date: saoPauloToday(),
      status: 'paid',
    })
  }

  if (session.status !== 'pending_payment') return { started: true }

  // Liga o relé; se o dispositivo estiver momentaneamente inacessível a sessão
  // fica paga porém pendente, e o polling do cliente tenta de novo.
  try {
    await controlMachineDevice(sb, {
      machineId: session.machine_id,
      organizationId: session.organization_id,
      action: 'start',
      durationSeconds: session.duration_minutes * 60,
    })
  } catch (err) {
    return { started: false, error: err instanceof Error ? err.message : 'Falha ao ligar a máquina' }
  }

  const endAt = new Date(now.getTime() + session.duration_minutes * 60_000)
  await sb.from('laundry_sessions').update({
    status: 'running',
    started_at: now.toISOString(),
    expected_end_at: endAt.toISOString(),
  }).eq('id', session.id).eq('status', 'pending_payment')

  await sb.from('laundry_machines').update({
    status: 'in_use',
    updated_at: now.toISOString(),
  }).eq('id', session.machine_id).eq('organization_id', session.organization_id)

  return { started: true }
}
