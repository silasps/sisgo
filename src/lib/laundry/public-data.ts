import type { SupabaseClient } from '@supabase/supabase-js'
import { checkMachinesOnlineBatch } from './control'
import { getLaundryPaymentSettings, paymentsConfigured } from './payments'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>

export type PublicMachine = {
  id: string
  name: string
  type: 'washer' | 'dryer'
  location: string | null
  status: 'available' | 'in_use' | 'maintenance'
  online: boolean
  busyUntil: string | null
  mine: boolean
}

export type PublicPricing = Record<string, {
  pricePerMinuteCents: number
  minMinutes: number
  maxMinutes: number
  stepMinutes: number
}>

// Carrega o estado da lavanderia para as páginas de cliente (pública e
// interna): máquinas com status/online, preços e se o PIX está habilitado.
// Também auto-completa sessões expiradas. `viewerUserId` marca as máquinas
// que o próprio usuário está usando.
export async function loadLaundryClientData(sbAdmin: AnySupabase, organizationId: string, viewerUserId?: string | null) {
  const [{ data: machines }, { data: sessions }, { data: pricing }, paymentSettings] = await Promise.all([
    sbAdmin.from('laundry_machines')
      .select('id, name, type, location, status, device_ip, device_type, connection_mode, cloud_server, cloud_device_id, cloud_auth_key')
      .eq('organization_id', organizationId)
      .neq('status', 'offline')
      .order('name'),
    sbAdmin.from('laundry_sessions')
      .select('id, machine_id, duration_minutes, started_at, expected_end_at, status, created_by')
      .eq('organization_id', organizationId)
      .eq('status', 'running'),
    sbAdmin.from('laundry_pricing')
      .select('machine_type, price_per_minute_cents, min_minutes, max_minutes, step_minutes')
      .eq('organization_id', organizationId)
      .eq('active', true),
    getLaundryPaymentSettings(sbAdmin, organizationId),
  ])

  type MachineRow = {
    id: string; name: string; type: string; location: string | null; status: string
    device_ip: string | null; device_type: string | null
    connection_mode: string | null; cloud_server: string | null
    cloud_device_id: string | null; cloud_auth_key: string | null
  }
  type SessionRow = { id: string; machine_id: string; duration_minutes: number; started_at: string; expected_end_at: string; status: string; created_by: string | null }
  type PricingRow = { machine_type: string; price_per_minute_cents: number; min_minutes: number; max_minutes: number; step_minutes: number }

  // Auto-completar sessões expiradas
  const now = new Date().toISOString()
  const expiredSessions = ((sessions ?? []) as SessionRow[])
    .filter(s => s.status === 'running' && s.expected_end_at && new Date(s.expected_end_at) <= new Date())
  if (expiredSessions.length > 0) {
    await Promise.all(expiredSessions.map(async (s) => {
      await sbAdmin.from('laundry_sessions').update({ status: 'completed', actual_end_at: now }).eq('id', s.id)
      await sbAdmin.from('laundry_machines').update({ status: 'available', updated_at: now }).eq('id', s.machine_id)
    }))
  }
  const expiredIds = new Set(expiredSessions.map(s => s.id))
  const expiredMachineIds = new Set(expiredSessions.map(s => s.machine_id))

  const machinesList = ((machines ?? []) as MachineRow[]).map(m =>
    expiredMachineIds.has(m.id) ? { ...m, status: 'available' } : m
  )
  const sessionsList = ((sessions ?? []) as SessionRow[]).filter(s => !expiredIds.has(s.id))
  const pricingList = (pricing ?? []) as PricingRow[]

  const onlineStatus = await checkMachinesOnlineBatch(sbAdmin, machinesList)

  const publicMachines: PublicMachine[] = machinesList.map(m => {
    const session = sessionsList.find(s => s.machine_id === m.id)
    return {
      id: m.id,
      name: m.name,
      type: m.type as 'washer' | 'dryer',
      location: m.location,
      status: m.status as 'available' | 'in_use' | 'maintenance',
      online: onlineStatus[m.id] ?? false,
      busyUntil: session?.expected_end_at ?? null,
      mine: !!(viewerUserId && session?.created_by === viewerUserId),
    }
  })

  const publicPricing: PublicPricing = Object.fromEntries(
    pricingList.map(p => [p.machine_type, {
      pricePerMinuteCents: p.price_per_minute_cents,
      minMinutes: p.min_minutes,
      maxMinutes: p.max_minutes,
      stepMinutes: p.step_minutes,
    }])
  )

  return {
    machines: publicMachines,
    pricing: publicPricing,
    paymentsEnabled: paymentsConfigured(paymentSettings),
  }
}
