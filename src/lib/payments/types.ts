export type PixChargeInput = {
  accessToken: string
  environment: 'sandbox' | 'production'
  customerId: string
  amount: number
  dueDate: string
  description: string
  externalReference: string
}

export type PixChargeResult = {
  providerChargeId: string
  pixCopyPaste: string | null
  pixQrCodeBase64: string | null
  invoiceUrl: string | null
  expiresAt: string | null
  rawResponse: Record<string, unknown>
}
