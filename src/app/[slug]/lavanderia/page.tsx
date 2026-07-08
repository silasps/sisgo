import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { checkMachinesOnline } from '@/app/[slug]/(admin)/hospedagem/lavanderia/actions'
import { LaundryBoard } from './LaundryBoard'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function PublicLaundryPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, laundry_enabled')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!org) notFound()
  const laundryEnabled = (org as { laundry_enabled?: boolean }).laundry_enabled ?? false
  if (!laundryEnabled) notFound()

  const [{ data: machines }, { data: sessions }, { data: pricing }] = await Promise.all([
    sbAdmin.from('laundry_machines')
      .select('id, name, type, location, status, device_ip, device_type, connection_mode, cloud_server, cloud_device_id, cloud_auth_key')
      .eq('organization_id', org.id)
      .neq('status', 'offline')
      .order('name'),
    sbAdmin.from('laundry_sessions')
      .select('id, machine_id, guest_name, duration_minutes, started_at, expected_end_at, status')
      .eq('organization_id', org.id)
      .eq('status', 'running'),
    sbAdmin.from('laundry_pricing')
      .select('machine_type, price_per_minute_cents, min_minutes, max_minutes, step_minutes')
      .eq('organization_id', org.id)
      .eq('active', true),
  ])

  type MachineRow = {
    id: string; name: string; type: string; location: string | null; status: string
    device_ip: string | null; device_type: string | null
    connection_mode: string | null; cloud_server: string | null
    cloud_device_id: string | null; cloud_auth_key: string | null
  }
  type SessionRow = { id: string; machine_id: string; guest_name: string | null; duration_minutes: number; started_at: string; expected_end_at: string; status: string }
  type PricingRow = { machine_type: string; price_per_minute_cents: number; min_minutes: number; max_minutes: number; step_minutes: number }

  // Auto-completar sessões expiradas
  const now = new Date().toISOString()
  const expiredSessions = ((sessions ?? []) as Array<{ id: string; machine_id: string; expected_end_at: string; status: string }>)
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

  // Verificar conectividade dos dispositivos
  const onlineStatus = await checkMachinesOnline(
    machinesList.map(m => ({
      id: m.id, device_ip: m.device_ip, device_type: m.device_type,
      connection_mode: m.connection_mode, cloud_server: m.cloud_server,
      cloud_device_id: m.cloud_device_id, cloud_auth_key: m.cloud_auth_key,
    }))
  )

  const boardMachines = machinesList.map(m => {
    const session = sessionsList.find(s => s.machine_id === m.id)
    const p = pricingList.find(pr => pr.machine_type === m.type)
    return {
      id: m.id,
      name: m.name,
      type: m.type as 'washer' | 'dryer',
      location: m.location,
      status: m.status as 'available' | 'in_use' | 'maintenance',
      online: onlineStatus[m.id] ?? false,
      session: session ? {
        guestName: session.guest_name,
        durationMinutes: session.duration_minutes,
        startedAt: session.started_at,
        expectedEndAt: session.expected_end_at,
      } : null,
      pricePerMinute: p?.price_per_minute_cents ?? null,
    }
  })

  return (
    <div className="min-h-dvh bg-gray-950">
      <LaundryBoard
        orgName={org.name}
        machines={boardMachines}
      />
    </div>
  )
}
