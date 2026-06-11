import type { PixChargeInput, PixChargeResult } from './types'

export async function createMercadoPagoPixCharge(input: PixChargeInput): Promise<PixChargeResult> {
  const response = await paymentRequest<Record<string, unknown>>('/v1/payments', input.accessToken, {
    method: 'POST',
    headers: {
      'x-idempotency-key': input.externalReference,
    },
    body: JSON.stringify({
      transaction_amount: Number(input.amount.toFixed(2)),
      description: input.description,
      payment_method_id: 'pix',
      external_reference: input.externalReference,
      date_of_expiration: new Date(`${input.dueDate}T23:59:59-03:00`).toISOString(),
      payer: {
        email: input.customerId.includes('@') ? input.customerId : 'pagador@sisgo.local',
      },
    }),
  })

  const transactionData = getRecord(getRecord(response.point_of_interaction).transaction_data)

  return {
    providerChargeId: String(response.id ?? ''),
    pixCopyPaste: asString(transactionData.qr_code),
    pixQrCodeBase64: asString(transactionData.qr_code_base64),
    invoiceUrl: asString(transactionData.ticket_url),
    expiresAt: asString(response.date_of_expiration),
    rawResponse: response,
  }
}

async function paymentRequest<T>(path: string, accessToken: string, init: RequestInit) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
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
    throw new Error(asString(payload.message) || `Falha ao chamar Mercado Pago (${response.status}).`)
  }
  return payload as T
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}
