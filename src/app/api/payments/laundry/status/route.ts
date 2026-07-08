import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLaundryPaymentSettings, isAsaasChargePaid, confirmLaundryPaymentAndStart } from '@/lib/laundry/payments'

// Polling da página pública: verifica o pagamento (fallback do webhook,
// consultando o Asaas direto) e, quando pago, garante que a máquina ligou.
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session')?.trim()
  if (!sessionId) return NextResponse.json({ error: 'session obrigatório.' }, { status: 400 })

  const sb = createAdminClient()
  const { data: session } = await sb.from('laundry_sessions')
    .select('id, organization_id, machine_id, duration_minutes, amount_paid, status, payment_status, guest_name, provider_charge_id, expected_end_at')
    .eq('id', sessionId)
    .single()
  if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })

  let startError: string | undefined

  if (session.status === 'pending_payment') {
    if (session.payment_status === 'pending' && session.provider_charge_id) {
      const settings = await getLaundryPaymentSettings(sb, session.organization_id)
      if (settings?.access_token && await isAsaasChargePaid(settings, session.provider_charge_id)) {
        const result = await confirmLaundryPaymentAndStart(sb, session)
        startError = result.error
      }
    } else if (session.payment_status === 'paid') {
      // pago mas o relé falhou na primeira tentativa — tenta ligar de novo
      const result = await confirmLaundryPaymentAndStart(sb, session)
      startError = result.error
    }
  }

  const { data: fresh } = await sb.from('laundry_sessions')
    .select('status, payment_status, expected_end_at')
    .eq('id', sessionId)
    .single()

  return NextResponse.json({
    status: fresh?.status ?? session.status,
    paymentStatus: fresh?.payment_status ?? session.payment_status,
    expectedEndAt: fresh?.expected_end_at ?? session.expected_end_at,
    startError: startError ?? null,
  })
}
