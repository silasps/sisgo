// Integração com a Shelly Cloud Control API v2.
// Docs: https://shelly-api-docs.shelly.cloud/cloud-control-api/communication-v2
//
// O dispositivo Shelly mantém conexão permanente com a nuvem da Shelly,
// então o SISGO consegue ligar/desligar de qualquer lugar — sem depender
// de IP local, port forwarding ou VPN.
//
// Limite da Shelly: 1 requisição/segundo por conta. O status aceita até
// 10 dispositivos por chamada, por isso agrupamos por conta (server+key).

export type ShellyCloudCreds = {
  server: string
  authKey: string
  deviceId: string
}

// Aceita "shelly-151-eu.shelly.cloud" ou "https://shelly-151-eu.shelly.cloud/"
export function normalizeCloudServer(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

// Device ID às vezes é copiado com dois-pontos (A8:03:2A:B1:23:45)
export function normalizeDeviceId(input: string): string {
  return input.trim().replace(/:/g, '').toLowerCase()
}

export async function cloudSetSwitch(
  creds: ShellyCloudCreds,
  opts: { on: boolean; toggleAfterSeconds?: number }
): Promise<{ ok: boolean; message: string }> {
  const url = `${normalizeCloudServer(creds.server)}/v2/devices/api/set/switch?auth_key=${encodeURIComponent(creds.authKey)}`
  const body: Record<string, unknown> = {
    id: normalizeDeviceId(creds.deviceId),
    on: opts.on,
    channel: 0,
  }
  if (opts.on && opts.toggleAfterSeconds && opts.toggleAfterSeconds > 0) {
    body.toggle_after = opts.toggleAfterSeconds
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true, message: 'Comando enviado via Shelly Cloud' }
    const text = await res.text().catch(() => '')
    return { ok: false, message: `Shelly Cloud respondeu HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ''}` }
  } catch {
    return { ok: false, message: 'Sem resposta da Shelly Cloud — verifique o Server URI e a Auth Key' }
  }
}

// Consulta o status de até 10 dispositivos de uma mesma conta em uma chamada.
// Retorna deviceId (normalizado) → online.
export async function cloudCheckOnline(
  account: { server: string; authKey: string },
  deviceIds: string[]
): Promise<Record<string, boolean>> {
  const ids = deviceIds.map(normalizeDeviceId)
  const results: Record<string, boolean> = Object.fromEntries(ids.map(id => [id, false]))
  if (ids.length === 0) return results

  const url = `${normalizeCloudServer(account.server)}/v2/devices/api/get?auth_key=${encodeURIComponent(account.authKey)}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids.slice(0, 10), select: ['status'] }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return results

    const data: unknown = await res.json()
    const devices = Array.isArray(data) ? data : []
    for (const d of devices) {
      // a API retorna online como 1/0 (número), não boolean
      const dev = d as { id?: string; online?: boolean | number }
      if (dev.id) {
        results[normalizeDeviceId(dev.id)] = dev.online === true || dev.online === 1
      }
    }
    return results
  } catch {
    return results
  }
}
