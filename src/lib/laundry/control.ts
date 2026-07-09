import type { SupabaseClient } from '@supabase/supabase-js'
import { buildUrl, type DeviceModel } from './devices'
import { cloudSetSwitch, cloudCheckOnline, normalizeDeviceId } from './shelly-cloud'

export type MachineConnection = {
  id: string
  device_ip: string | null
  device_type: string | null
  connection_mode: string | null
  cloud_server: string | null
  cloud_device_id: string | null
  cloud_auth_key: string | null
}

export function hasCloudCreds(m: Pick<MachineConnection, 'connection_mode' | 'cloud_server' | 'cloud_device_id' | 'cloud_auth_key'>): boolean {
  return m.connection_mode === 'cloud' && !!m.cloud_server && !!m.cloud_device_id && !!m.cloud_auth_key
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>

export async function getDeviceModel(sb: AnySupabase, deviceType: string | null): Promise<DeviceModel | null> {
  if (!deviceType) return null
  const { data } = await sb.from('laundry_device_models')
    .select('*')
    .eq('id', deviceType)
    .single()
  return (data as DeviceModel | null) ?? null
}

// Liga/desliga o relé da máquina, seja via Shelly Cloud ou IP local.
// Lança Error com mensagem amigável quando a comunicação falha.
export async function controlMachineDevice(sb: AnySupabase, data: {
  machineId: string
  organizationId: string
  action: 'start' | 'stop'
  durationSeconds?: number
}) {
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

// Verifica várias máquinas de uma vez: as cloud são agrupadas por conta
// (a API da Shelly aceita até 10 devices por chamada, limite 1 req/s).
export async function checkMachinesOnlineBatch(sb: AnySupabase, machines: MachineConnection[]): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {}

  const cloudMachines = machines.filter(hasCloudCreds)
  const localMachines = machines.filter(m => !hasCloudCreds(m))

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

  const deviceTypes = [...new Set(localMachines.map(m => m.device_type).filter(Boolean))] as string[]
  const { data: models } = await sb.from('laundry_device_models')
    .select('*')
    .in('id', deviceTypes.length > 0 ? deviceTypes : ['_none_'])
  const modelMap = new Map(((models ?? []) as DeviceModel[]).map(m => [m.id, m]))

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

export async function isMachineOnline(sb: AnySupabase, conn: MachineConnection): Promise<boolean> {
  if (hasCloudCreds(conn)) {
    const online = await cloudCheckOnline(
      { server: conn.cloud_server!, authKey: conn.cloud_auth_key! },
      [conn.cloud_device_id!]
    )
    return online[normalizeDeviceId(conn.cloud_device_id!)] ?? false
  }
  if (!conn.device_ip) return false
  const model = await getDeviceModel(sb, conn.device_type)
  const url = model ? buildUrl(model.status_url_template, conn.device_ip, 0) : `http://${conn.device_ip}/status`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}
