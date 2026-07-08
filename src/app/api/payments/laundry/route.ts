import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLaundryPaymentSettings, paymentsConfigured, createLaundrySessionCharge } from '@/lib/laundry/payments'
import { isMachineOnline, type MachineConnection } from '@/lib/laundry/control'

// Cria uma cobrança PIX para liberar uma máquina — chamada pela página pública.
export async function POST(request: NextRequest) {
  let body: { slug?: string; machineId?: string; durationMinutes?: number; guestName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const slug = String(body.slug ?? '').trim()
  const machineId = String(body.machineId ?? '').trim()
  const durationMinutes = Number(body.durationMinutes)
  const guestName = String(body.guestName ?? '').trim().slice(0, 80) || null

  if (!slug || !machineId || !Number.isInteger(durationMinutes) || durationMinutes < 1) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const sb = createAdminClient()

  const { data: org } = await sb.from('organizations')
    .select('id, laundry_enabled')
    .eq('slug', slug).eq('active', true).single()
  if (!org || !(org as { laundry_enabled?: boolean }).laundry_enabled) {
    return NextResponse.json({ error: 'Lavanderia não encontrada.' }, { status: 404 })
  }

  const settings = await getLaundryPaymentSettings(sb, org.id)
  if (!paymentsConfigured(settings)) {
    return NextResponse.json({ error: 'Pagamento online não está habilitado nesta lavanderia.' }, { status: 400 })
  }

  const { data: machine } = await sb.from('laundry_machines')
    .select('id, name, type, status, device_ip, device_type, connection_mode, cloud_server, cloud_device_id, cloud_auth_key')
    .eq('id', machineId).eq('organization_id', org.id).single()
  if (!machine) return NextResponse.json({ error: 'Máquina não encontrada.' }, { status: 404 })
  if (machine.status !== 'available') {
    return NextResponse.json({ error: 'Esta máquina está ocupada no momento.' }, { status: 409 })
  }

  // valida duração e calcula o preço no servidor (nunca confia no cliente)
  const { data: pricing } = await sb.from('laundry_pricing')
    .select('id, price_per_minute_cents, min_minutes, max_minutes, step_minutes')
    .eq('organization_id', org.id).eq('machine_type', machine.type).eq('active', true)
    .maybeSingle()
  if (!pricing) {
    return NextResponse.json({ error: 'Preço não configurado para esta máquina.' }, { status: 400 })
  }
  const validDuration = durationMinutes >= pricing.min_minutes
    && durationMinutes <= pricing.max_minutes
    && (durationMinutes - pricing.min_minutes) % pricing.step_minutes === 0
  if (!validDuration) {
    return NextResponse.json({ error: 'Tempo selecionado inválido.' }, { status: 400 })
  }
  const amountCents = durationMinutes * pricing.price_per_minute_cents

  // não cobra se o relé não estiver alcançável
  const online = await isMachineOnline(sb, machine as MachineConnection)
  if (!online) {
    return NextResponse.json({ error: 'A máquina está sem conexão no momento. Procure a hospitalidade.' }, { status: 503 })
  }

  // limpa cobranças abandonadas e bloqueia pagamento duplo simultâneo
  const staleCutoff = new Date(Date.now() - 15 * 60_000).toISOString()
  await sb.from('laundry_sessions')
    .update({ status: 'cancelled', payment_status: 'failed' })
    .eq('machine_id', machineId).eq('status', 'pending_payment').lt('created_at', staleCutoff)

  const { data: pendingExisting } = await sb.from('laundry_sessions')
    .select('id')
    .eq('machine_id', machineId).eq('status', 'pending_payment')
    .gte('created_at', staleCutoff)
    .limit(1)
  if (pendingExisting && pendingExisting.length > 0) {
    return NextResponse.json({ error: 'Já existe um pagamento em andamento para esta máquina. Aguarde alguns minutos.' }, { status: 409 })
  }

  const { data: session, error: sessionError } = await sb.from('laundry_sessions').insert({
    organization_id: org.id,
    machine_id:      machineId,
    guest_name:      guestName,
    pricing_id:      pricing.id,
    duration_minutes: durationMinutes,
    amount_paid:     amountCents,
    payment_method:  'pix',
    payment_status:  'pending',
    status:          'pending_payment',
  }).select('id').single()
  if (sessionError || !session) {
    return NextResponse.json({ error: sessionError?.message ?? 'Falha ao criar a sessão.' }, { status: 500 })
  }

  try {
    const charge = await createLaundrySessionCharge(sb, {
      settings: settings!,
      organizationId: org.id,
      sessionId: session.id,
      machineName: machine.name,
      durationMinutes,
      amountCents,
    })
    return NextResponse.json({
      sessionId: session.id,
      amountCents,
      pixCopyPaste: charge.pixCopyPaste,
      pixQrCodeBase64: charge.pixQrCodeBase64,
    })
  } catch (err) {
    await sb.from('laundry_sessions')
      .update({ status: 'cancelled', payment_status: 'failed' })
      .eq('id', session.id)
    const message = err instanceof Error ? err.message : 'Falha ao gerar a cobrança PIX.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
