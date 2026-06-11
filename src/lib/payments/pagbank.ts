import type { PixChargeInput, PixChargeResult } from './types'

export async function createPagBankPixCharge(input: PixChargeInput): Promise<PixChargeResult> {
  const baseUrl = input.environment === 'production'
    ? 'https://api.pagseguro.com'
    : 'https://sandbox.api.pagseguro.com'
  const response = await pagBankRequest<Record<string, unknown>>(`${baseUrl}/orders`, input.accessToken, {
    method: 'POST',
    body: JSON.stringify({
      reference_id: input.externalReference,
      customer: {
        name: input.customerId || 'Consumidor SISGO',
      },
      items: [{
        name: input.description,
        quantity: 1,
        unit_amount: Math.round(input.amount * 100),
      }],
      qr_codes: [{
        amount: {
          value: Math.round(input.amount * 100),
        },
        expiration_date: new Date(`${input.dueDate}T23:59:59-03:00`).toISOString(),
      }],
    }),
  })

  const qrCode = Array.isArray(response.qr_codes) ? getRecord(response.qr_codes[0]) : {}
  const links = Array.isArray(qrCode.links) ? qrCode.links.map(getRecord) : []
  const textLink = links.find(link => link.media === 'text/plain')
  const imageLink = links.find(link => link.media === 'image/png')
  const pixCopyPaste = asString(qrCode.text) ?? await fetchText(asString(textLink?.href), input.accessToken)
  const pngBase64 = await fetchImageBase64(asString(imageLink?.href), input.accessToken)

  return {
    providerChargeId: String(response.id ?? ''),
    pixCopyPaste,
    pixQrCodeBase64: pngBase64,
    invoiceUrl: asString(getRecord((Array.isArray(response.links) ? response.links : []).map(getRecord).find(link => link.rel === 'SELF')).href),
    expiresAt: asString(qrCode.expiration_date),
    rawResponse: response,
  }
}

async function pagBankRequest<T>(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(asString(payload.message) || `Falha ao chamar PagBank (${response.status}).`)
  }
  return payload as T
}

async function fetchText(url: string | null, accessToken: string) {
  if (!url) return null
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  return response.ok ? response.text() : null
}

async function fetchImageBase64(url: string | null, accessToken: string) {
  if (!url) return null
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  if (!response.ok) return null
  const buffer = Buffer.from(await response.arrayBuffer())
  return buffer.toString('base64')
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}
