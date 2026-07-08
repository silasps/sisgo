'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { buildUrl, type DeviceModel } from '@/lib/laundry/devices'
import { cloudSetSwitch, cloudCheckOnline, normalizeCloudServer, normalizeDeviceId } from '@/lib/laundry/shelly-cloud'

export type MachineConnection = {
  id: string
  device_ip: string | null
  device_type: string | null
  connection_mode: string | null
  cloud_server: string | null
  cloud_device_id: string | null
  cloud_auth_key: string | null
}

function hasCloudCreds(m: Pick<MachineConnection, 'connection_mode' | 'cloud_server' | 'cloud_device_id' | 'cloud_auth_key'>): boolean {
  return m.connection_mode === 'cloud' && !!m.cloud_server && !!m.cloud_device_id && !!m.cloud_auth_key
}

// ── Toggle ──────────────────────────────────────────────────────────────────

export async function toggleLaundryEnabled(organizationId: string, enabled: boolean) {
  const sb = createAdminClient()
  const { error } = await sb.from('organizations').update({
    laundry_enabled: enabled,
  }).eq('id', organizationId)
  if (error) throw new Error(error.message)
}

// ── Machines ────────────────────────────────────────────────────────────────

export async function createMachine(data: {
  organizationId: string
  name: string
  type: string
  location: string | null
  deviceType: string | null
  deviceIp: string | null
  deviceAuth: string | null
  connectionMode: string | null
  cloudServer: string | null
  cloudDeviceId: string | null
  cloudAuthKey: string | null
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('laundry_machines').insert({
    organization_id: data.organizationId,
    name:            data.name,
    type:            data.type,
    location:        data.location,
    device_type:     data.deviceType,
    device_ip:       data.deviceIp,
    device_auth:     data.deviceAuth,
    connection_mode: data.connectionMode === 'cloud' ? 'cloud' : 'local',
    cloud_server:    data.cloudServer ? normalizeCloudServer(data.cloudServer) : null,
    cloud_device_id: data.cloudDeviceId ? normalizeDeviceId(data.cloudDeviceId) : null,
    cloud_auth_key:  data.cloudAuthKey?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

export async function updateMachine(data: {
  id: string
  organizationId: string
  name: string
  type: string
  location: string | null
  status: string
  deviceType: string | null
  deviceIp: string | null
  deviceAuth: string | null
  connectionMode: string | null
  cloudServer: string | null
  cloudDeviceId: string | null
  cloudAuthKey: string | null
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('laundry_machines').update({
    name:        data.name,
    type:        data.type,
    location:    data.location,
    status:      data.status,
    device_type: data.deviceType,
    device_ip:   data.deviceIp,
    device_auth: data.deviceAuth,
    connection_mode: data.connectionMode === 'cloud' ? 'cloud' : 'local',
    cloud_server:    data.cloudServer ? normalizeCloudServer(data.cloudServer) : null,
    cloud_device_id: data.cloudDeviceId ? normalizeDeviceId(data.cloudDeviceId) : null,
    cloud_auth_key:  data.cloudAuthKey?.trim() || null,
    updated_at:  new Date().toISOString(),
  }).eq('id', data.id).eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

export async function deleteMachine(data: {
  id: string
  organizationId: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('laundry_machines')
    .delete()
    .eq('id', data.id)
    .eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

// ── Pricing ─────────────────────────────────────────────────────────────────

export async function upsertPricing(data: {
  id: string | null
  organizationId: string
  machineType: string
  pricePerMinuteCents: number
  minMinutes: number
  maxMinutes: number
  stepMinutes: number
}) {
  const sb = createAdminClient()
  const row = {
    organization_id:       data.organizationId,
    machine_type:          data.machineType,
    price_per_minute_cents: data.pricePerMinuteCents,
    min_minutes:           data.minMinutes,
    max_minutes:           data.maxMinutes,
    step_minutes:          data.stepMinutes,
    active:                true,
  }
  if (data.id) {
    const { error } = await sb.from('laundry_pricing').update(row).eq('id', data.id).eq('organization_id', data.organizationId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await sb.from('laundry_pricing').insert(row)
    if (error) throw new Error(error.message)
  }
}

// ── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(data: {
  organizationId: string
  machineId: string
  personId: string | null
  guestName: string | null
  pricingId: string | null
  durationMinutes: number
  amountPaid: number
  paymentMethod: string
  paymentStatus: string
  notes: string | null
  createdBy: string
}) {
  const sb = createAdminClient()
  const now = new Date()
  const endAt = new Date(now.getTime() + data.durationMinutes * 60_000)

  const { error } = await sb.from('laundry_sessions').insert({
    organization_id: data.organizationId,
    machine_id:      data.machineId,
    person_id:       data.personId,
    guest_name:      data.guestName,
    pricing_id:      data.pricingId,
    duration_minutes: data.durationMinutes,
    amount_paid:     data.amountPaid,
    payment_method:  data.paymentMethod,
    payment_status:  data.paymentStatus,
    status:          'running',
    started_at:      now.toISOString(),
    expected_end_at: endAt.toISOString(),
    notes:           data.notes,
    created_by:      data.createdBy,
  })
  if (error) throw new Error(error.message)

  await sb.from('laundry_machines').update({
    status: 'in_use',
    updated_at: now.toISOString(),
  }).eq('id', data.machineId).eq('organization_id', data.organizationId)
}

export async function completeSession(data: {
  id: string
  organizationId: string
  machineId: string
}) {
  const sb = createAdminClient()
  const now = new Date().toISOString()

  const { error } = await sb.from('laundry_sessions').update({
    status: 'completed',
    actual_end_at: now,
  }).eq('id', data.id).eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)

  await sb.from('laundry_machines').update({
    status: 'available',
    updated_at: now,
  }).eq('id', data.machineId).eq('organization_id', data.organizationId)
}

export async function cancelSession(data: {
  id: string
  organizationId: string
  machineId: string
}) {
  const sb = createAdminClient()
  const now = new Date().toISOString()

  const { error } = await sb.from('laundry_sessions').update({
    status: 'cancelled',
    actual_end_at: now,
  }).eq('id', data.id).eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)

  await sb.from('laundry_machines').update({
    status: 'available',
    updated_at: now,
  }).eq('id', data.machineId).eq('organization_id', data.organizationId)
}

// ── Shelly control ──────────────────────────────────────────────────────────

async function getDeviceModel(sb: ReturnType<typeof createAdminClient>, deviceType: string | null): Promise<DeviceModel | null> {
  if (!deviceType) return null
  const { data } = await sb.from('laundry_device_models')
    .select('*')
    .eq('id', deviceType)
    .single()
  return (data as DeviceModel | null) ?? null
}

export async function checkDeviceOnline(ip: string, deviceType: string | null): Promise<boolean> {
  const sb = createAdminClient()
  const model = await getDeviceModel(sb, deviceType)
  const url = model ? buildUrl(model.status_url_template, ip, 0) : `http://${ip}/status`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export async function checkMachinesOnline(machines: MachineConnection[]): Promise<Record<string, boolean>> {
  const sb = createAdminClient()
  const results: Record<string, boolean> = {}

  const cloudMachines = machines.filter(hasCloudCreds)
  const localMachines = machines.filter(m => !hasCloudCreds(m))

  // Cloud: agrupa por conta (server + auth key) — a API aceita até 10 ids por chamada
  const accounts = new Map<string, { server: string; authKey: string; items: Array<{ machineId: string; deviceId: string }> }>()
  for (const m of cloudMachines) {
    const key = `${m.cloud_server}|${m.cloud_auth_key}`
    if (!accounts.has(key)) accounts.set(key, { server: m.cloud_server!, authKey: m.cloud_auth_key!, items: [] })
    accounts.get(key)!.items.push({ machineId: m.id, deviceId: m.cloud_device_id! })
  }

  const cloudCheck = Promise.all(
    [...accounts.values()].map(async (acc) => {
      const online = await cloudCheckOnline({ server: acc.server, authKey: acc.authKey }, acc.items.map(i => i.deviceId))
      for (const item of acc.items) {
        results[item.machineId] = online[normalizeDeviceId(item.deviceId)] ?? false
      }
    })
  )

  // Local: consulta cada IP direto (só funciona se o servidor alcança a rede do dispositivo)
  const deviceTypes = [...new Set(localMachines.map(m => m.device_type).filter(Boolean))] as string[]
  const { data: models } = await sb.from('laundry_device_models')
    .select('*')
    .in('id', deviceTypes.length > 0 ? deviceTypes : ['_none_'])
  const modelMap = new Map((models ?? []).map((m: DeviceModel) => [m.id, m]))

  const localCheck = Promise.all(
    localMachines.map(async (m) => {
      if (!m.device_ip) { results[m.id] = false; return }
      const model = m.device_type ? modelMap.get(m.device_type) ?? null : null
      const url = model ? buildUrl(model.status_url_template, m.device_ip, 0) : `http://${m.device_ip}/status`
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
        results[m.id] = res.ok
      } catch {
        results[m.id] = false
      }
    })
  )

  await Promise.all([cloudCheck, localCheck])
  return results
}

export async function testDeviceConnection(data: {
  deviceIp: string
  deviceType: string | null
}): Promise<{ ok: boolean; message: string }> {
  const sb = createAdminClient()
  const model = await getDeviceModel(sb, data.deviceType)
  const url = model ? buildUrl(model.status_url_template, data.deviceIp, 0) : `http://${data.deviceIp}/status`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.ok) return { ok: true, message: `Conectado com sucesso (${model?.label ?? 'dispositivo'})` }
    return { ok: false, message: `Dispositivo respondeu com erro (HTTP ${res.status})` }
  } catch {
    return { ok: false, message: 'Sem resposta — verifique o IP e se o dispositivo está ligado na mesma rede' }
  }
}

export async function controlDevice(data: {
  machineId: string
  organizationId: string
  action: 'start' | 'stop'
  durationSeconds?: number
}) {
  const sb = createAdminClient()
  const { data: machine, error } = await sb.from('laundry_machines')
    .select('device_ip, device_type, connection_mode, cloud_server, cloud_device_id, cloud_auth_key')
    .eq('id', data.machineId)
    .eq('organization_id', data.organizationId)
    .single()

  if (error || !machine) throw new Error('Máquina não encontrada')

  const conn = machine as Omit<MachineConnection, 'id'>
  const seconds = data.durationSeconds ?? 0

  if (hasCloudCreds(conn)) {
    const result = await cloudSetSwitch(
      { server: conn.cloud_server!, authKey: conn.cloud_auth_key!, deviceId: conn.cloud_device_id! },
      data.action === 'start' ? { on: true, toggleAfterSeconds: seconds } : { on: false }
    )
    if (!result.ok) throw new Error(result.message)
    return
  }

  const ip = conn.device_ip
  if (!ip) throw new Error('Conexão do dispositivo não configurada (IP local ou Shelly Cloud)')

  const model = await getDeviceModel(sb, conn.device_type)
  const url = data.action === 'start'
    ? (model ? buildUrl(model.start_url_template, ip, seconds) : `http://${ip}/relay/0?turn=on&timer=${seconds}`)
    : (model ? buildUrl(model.stop_url_template, ip, 0) : `http://${ip}/relay/0?turn=off`)

  const res = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null)
  if (!res || !res.ok) throw new Error(`Falha ao comunicar com o dispositivo (${model?.label ?? 'desconhecido'})`)
}

export async function testMachineConnection(data: {
  machineId: string
  organizationId: string
}): Promise<{ ok: boolean; message: string }> {
  const sb = createAdminClient()
  const { data: machine, error } = await sb.from('laundry_machines')
    .select('id, device_ip, device_type, connection_mode, cloud_server, cloud_device_id, cloud_auth_key')
    .eq('id', data.machineId)
    .eq('organization_id', data.organizationId)
    .single()

  if (error || !machine) return { ok: false, message: 'Máquina não encontrada' }

  const conn = machine as MachineConnection
  if (hasCloudCreds(conn)) {
    const online = await cloudCheckOnline(
      { server: conn.cloud_server!, authKey: conn.cloud_auth_key! },
      [conn.cloud_device_id!]
    )
    const isOnline = online[normalizeDeviceId(conn.cloud_device_id!)] ?? false
    return isOnline
      ? { ok: true, message: 'Dispositivo online na Shelly Cloud!' }
      : { ok: false, message: 'A Shelly Cloud não reconhece este dispositivo como online — confira Device ID, Auth Key e se o Shelly está com internet' }
  }

  if (!conn.device_ip) return { ok: false, message: 'Configure o IP local ou a conexão Shelly Cloud' }
  return testDeviceConnection({ deviceIp: conn.device_ip, deviceType: conn.device_type })
}

// ── Device model management ─────────────────────────────────────────────────

export async function createDeviceModel(data: {
  id: string
  organizationId: string
  brand: string
  model: string
  label: string
  startUrlTemplate: string
  stopUrlTemplate: string
  statusUrlTemplate: string
  setupInstructions: string | null
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('laundry_device_models').insert({
    id:                  data.id,
    organization_id:     data.organizationId,
    brand:               data.brand,
    model:               data.model,
    label:               data.label,
    start_url_template:  data.startUrlTemplate,
    stop_url_template:   data.stopUrlTemplate,
    status_url_template: data.statusUrlTemplate,
    setup_instructions:  data.setupInstructions,
    is_global:           false,
  })
  if (error) throw new Error(error.message)
}

export async function deleteDeviceModel(data: {
  id: string
  organizationId: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('laundry_device_models')
    .delete()
    .eq('id', data.id)
    .eq('organization_id', data.organizationId)
    .eq('is_global', false)
  if (error) throw new Error(error.message)
}

export async function startMachine(data: {
  organizationId: string
  machineId: string
  durationMinutes: number
  amountPaid: number
  paymentMethod: string
  guestName: string | null
  personId: string | null
  pricingId: string | null
  notes: string | null
  createdBy: string
}) {
  const durationSeconds = data.durationMinutes * 60

  await controlDevice({
    machineId: data.machineId,
    organizationId: data.organizationId,
    action: 'start',
    durationSeconds,
  })

  await createSession({
    organizationId: data.organizationId,
    machineId:      data.machineId,
    personId:       data.personId,
    guestName:      data.guestName,
    pricingId:      data.pricingId,
    durationMinutes: data.durationMinutes,
    amountPaid:     data.amountPaid,
    paymentMethod:  data.paymentMethod,
    paymentStatus:  'paid',
    notes:          data.notes,
    createdBy:      data.createdBy,
  })
}

export async function stopMachine(data: {
  sessionId: string
  machineId: string
  organizationId: string
}) {
  await controlDevice({
    machineId: data.machineId,
    organizationId: data.organizationId,
    action: 'stop',
  })

  await completeSession({
    id: data.sessionId,
    organizationId: data.organizationId,
    machineId: data.machineId,
  })
}
