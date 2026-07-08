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
