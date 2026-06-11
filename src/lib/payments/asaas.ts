import type { PixChargeInput, PixChargeResult } from './types'

export async function createAsaasPixCharge(input: PixChargeInput): Promise<PixChargeResult> {
  const baseUrl = input.environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3'

  const payment = await asaasRequest<Record<string, unknown>>(`${baseUrl}/payments`, input.accessToken, {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customerId,
      billingType: 'PIX',
      value: Number(input.amount.toFixed(2)),
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
    }),
  })

  const paymentId = String(payment.id ?? '')
  if (!paymentId) {
    throw new Error('O provedor não retornou o ID da cobrança Pix.')
  }

  const qrCode = await asaasRequest<Record<string, unknown>>(`${baseUrl}/payments/${paymentId}/pixQrCode`, input.accessToken)

  return {
    providerChargeId: paymentId,
    pixCopyPaste: typeof qrCode.payload === 'string' ? qrCode.payload : null,
    pixQrCodeBase64: typeof qrCode.encodedImage === 'string' ? qrCode.encodedImage : null,
    invoiceUrl: typeof payment.invoiceUrl === 'string' ? payment.invoiceUrl : null,
    expiresAt: typeof qrCode.expirationDate === 'string' ? qrCode.expirationDate : null,
    rawResponse: { payment, qrCode },
  }
}

async function asaasRequest<T>(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: accessToken,
      'user-agent': 'SISGO/1.0',
      ...init.headers,
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = Array.isArray(payload.errors)
      ? payload.errors.map((error: { description?: string }) => error.description).filter(Boolean).join(' ')
      : null
    throw new Error(message || `Falha ao chamar Asaas (${response.status}).`)
  }

  return payload as T
}
