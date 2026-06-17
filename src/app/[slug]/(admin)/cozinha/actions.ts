'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createAsaasPixCharge } from '@/lib/payments/asaas'
import { createMercadoPagoPixCharge } from '@/lib/payments/mercado-pago'
import { createPagBankPixCharge } from '@/lib/payments/pagbank'
import type { PixChargeResult } from '@/lib/payments/types'
import { PHONE_COUNTRIES } from '@/lib/i18n/phoneCountries'
import sharp from 'sharp'

export async function createMealConsumer(data: {
  organizationId: string
  consumerName: string
  mealDate: string
  breakfast: boolean
  lunch: boolean
  dinner: boolean
  paymentType: string
  paidUntil: string | null
  notes: string | null
  createdBy: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('kitchen_meal_consumers').insert({
    organization_id: data.organizationId,
    consumer_name:   data.consumerName,
    meal_date:       data.mealDate,
    breakfast:       data.breakfast,
    lunch:           data.lunch,
    dinner:          data.dinner,
    payment_type:    data.paymentType,
    paid_until:      data.paidUntil,
    notes:           data.notes,
    created_by:      data.createdBy,
  })
  if (error) throw new Error(error.message)
}

export async function createMealConsumers(data: {
  organizationId: string
  consumerName: string
  mealItems: Array<{
    date: string
    purchasedMealIds: string[]
    servedMealIds: string[]
    subtotal: number
    discount: number
    finalAmount: number
  }>
  manualDiscountAmount: number
  finalAmount: number
  notes: string | null
  createdBy: string
  requestedBy?: string | null
  paymentStatus?: 'pending' | 'paid'
  purchaseSource?: 'secretaria' | 'self_service'
  createFinancialEntry?: boolean
}) {
  const purchaseGroupId = crypto.randomUUID()
  const paymentStatus = data.paymentStatus ?? 'paid'
  const purchaseSource = data.purchaseSource ?? 'secretaria'
  const totalSubtotal = data.mealItems.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0)
  const rows = data.mealItems
    .filter(item => item.date && item.servedMealIds.length > 0)
    .map(item => {
      const manualDiscount = totalSubtotal > 0 ? data.manualDiscountAmount * (Number(item.subtotal ?? 0) / totalSubtotal) : 0
      const discountAmount = Number(item.discount ?? 0) + manualDiscount

      return {
        organization_id: data.organizationId,
        purchase_group_id: purchaseGroupId,
        consumer_name:   data.consumerName,
        meal_date:       item.date,
        breakfast:       item.servedMealIds.includes('breakfast'),
        lunch:           item.servedMealIds.includes('lunch'),
        dinner:          item.servedMealIds.includes('dinner'),
        selected_meals:   item.servedMealIds,
        payment_type:    'refeicao',
        subtotal_amount: item.subtotal,
        discount_amount: discountAmount,
        final_amount:    Math.max(0, Number(item.subtotal ?? 0) - discountAmount),
        notes:           data.notes,
        created_by:      data.createdBy,
        requested_by:     data.requestedBy ?? data.createdBy,
        payment_status:   paymentStatus,
        purchase_source:  purchaseSource,
        paid_at:          paymentStatus === 'paid' ? new Date().toISOString() : null,
        paid_by:          paymentStatus === 'paid' ? data.createdBy : null,
      }
    })

  if (rows.length === 0) return

  const sb = createAdminClient()
  const { error } = await sb.from('kitchen_meal_consumers').insert(rows)
  if (error) throw new Error(error.message)

  if (purchaseSource === 'self_service' && paymentStatus === 'pending') {
    await createAutomaticPixCharge({
      organizationId: data.organizationId,
      purchaseGroupId,
      consumerName: data.consumerName,
      amount: data.finalAmount,
      firstMealDate: rows[0].meal_date,
    })
  }

  if (data.createFinancialEntry ?? paymentStatus === 'paid') {
    const { error: financialError } = await sb.from('financial_transactions').insert({
      organization_id: data.organizationId,
      description:     `Refeições - ${data.consumerName}`,
      amount:          data.finalAmount,
      type:            'income',
      category:        'Cozinha',
      date:            rows[0].meal_date,
      status:          'paid',
      created_by:      data.createdBy,
    })
    if (financialError) throw new Error(financialError.message)
  }

  return { purchaseGroupId }
}

export async function confirmMealPayment(data: {
  organizationId: string
  purchaseGroupId: string
  confirmedBy: string
}) {
  const sb = createAdminClient()
  const { data: rows, error: readError } = await sb
    .from('kitchen_meal_consumers')
    .select('consumer_name, meal_date, final_amount')
    .eq('organization_id', data.organizationId)
    .eq('purchase_group_id', data.purchaseGroupId)
    .eq('payment_status', 'pending')
  if (readError) throw new Error(readError.message)
  if (!rows || rows.length === 0) return

  const { error: updateError } = await sb
    .from('kitchen_meal_consumers')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: data.confirmedBy,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', data.organizationId)
    .eq('purchase_group_id', data.purchaseGroupId)
  if (updateError) throw new Error(updateError.message)

  const total = rows.reduce((sum, row) => sum + Number(row.final_amount ?? 0), 0)
  const first = rows[0]
  const { error: financialError } = await sb.from('financial_transactions').insert({
    organization_id: data.organizationId,
    description:     `Refeições - ${first.consumer_name}`,
    amount:          total,
    type:            'income',
    category:        'Cozinha',
    date:            first.meal_date,
    status:          'paid',
    created_by:      data.confirmedBy,
  })
  if (financialError) throw new Error(financialError.message)
}

export async function uploadMealPaymentProof(data: {
  organizationId: string
  purchaseGroupId: string
  file: File
  uploadedBy: string
}) {
  if (!data.file || data.file.size === 0) return
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(data.file.type)) {
    throw new Error('Envie uma imagem ou PDF como comprovante.')
  }
  if (data.file.size > 20 * 1024 * 1024) {
    throw new Error('O comprovante deve ter até 20 MB.')
  }

  const extByType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }
  let uploadBuffer: Buffer<ArrayBufferLike> = Buffer.from(await data.file.arrayBuffer())
  let uploadType = data.file.type
  let uploadName = data.file.name
  if (data.file.type.startsWith('image/')) {
    uploadBuffer = await sharp(uploadBuffer).webp({ quality: 85 }).toBuffer()
    uploadType = 'image/webp'
    uploadName = data.file.name.replace(/\.[^.]+$/, '') + '.webp'
  }

  const extension = extByType[uploadType] ?? 'bin'
  const path = `meal-payment-proofs/${data.organizationId}/${data.purchaseGroupId}/${Date.now()}.${extension}`
  const sb = createAdminClient()
  const { error: uploadError } = await sb.storage
    .from('applicant-docs')
    .upload(path, uploadBuffer, {
      contentType: uploadType,
      upsert: true,
    })
  if (uploadError) throw new Error(uploadError.message)

  const { error } = await sb
    .from('kitchen_meal_consumers')
    .update({
      payment_proof_path: path,
      payment_proof_name: uploadName,
      payment_proof_mime: uploadType,
      payment_proof_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', data.organizationId)
    .eq('purchase_group_id', data.purchaseGroupId)
    .eq('payment_status', 'pending')
  if (error) throw new Error(error.message)
}

export async function requestMealPaymentProof(data: {
  organizationId: string
  purchaseGroupId: string
  requestedBy: string
}) {
  const message = 'Houve um problema com a confirmação de pagamento da sua refeição. Por favor, coloque o comprovante aqui ou dirija-se à Secretaria. Obrigado.'
  const sb = createAdminClient()
  const { error } = await sb
    .from('kitchen_meal_consumers')
    .update({
      payment_proof_requested_at: new Date().toISOString(),
      payment_proof_requested_by: data.requestedBy,
      payment_proof_request_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', data.organizationId)
    .eq('purchase_group_id', data.purchaseGroupId)
    .eq('payment_status', 'pending')
  if (error) throw new Error(error.message)

  const { error: historyError } = await sb.from('kitchen_meal_payment_reviews').insert({
    organization_id: data.organizationId,
    purchase_group_id: data.purchaseGroupId,
    action: 'proof_requested',
    reason: message,
    reviewed_by: data.requestedBy,
  })
  if (historyError) throw new Error(historyError.message)
}

export async function rejectMealPayment(data: {
  organizationId: string
  purchaseGroupId: string
  rejectedBy: string
  reason: string
}) {
  const reason = data.reason.trim()
  if (!reason) throw new Error('Informe a justificativa da recusa.')

  const sb = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await sb
    .from('kitchen_meal_consumers')
    .update({
      payment_status: 'rejected',
      payment_rejected_at: now,
      payment_rejected_by: data.rejectedBy,
      payment_rejection_reason: reason,
      payment_proof_requested_at: null,
      payment_proof_requested_by: null,
      payment_proof_request_message: null,
      updated_at: now,
    })
    .eq('organization_id', data.organizationId)
    .eq('purchase_group_id', data.purchaseGroupId)
    .eq('payment_status', 'pending')
  if (error) throw new Error(error.message)

  const { error: historyError } = await sb.from('kitchen_meal_payment_reviews').insert({
    organization_id: data.organizationId,
    purchase_group_id: data.purchaseGroupId,
    action: 'payment_rejected',
    reason,
    reviewed_by: data.rejectedBy,
  })
  if (historyError) throw new Error(historyError.message)
}

export async function updateMealSettings(data: {
  organizationId: string
  breakfastPrice: number
  lunchPrice: number
  dinnerPrice: number
  comboLunchDinnerIncludesBreakfast: boolean
  lunchDinnerDiscountPercent: number
  mealOptions: Array<{ id: string; label: string; price: number }>
  comboRules: Array<{ id: string; name: string; mealIds: string[]; rewardMealIds?: string[]; discountPercent: number }>
  updatedBy: string
}) {
  const findPrice = (id: string, fallback: number) => data.mealOptions.find(meal => meal.id === id)?.price ?? fallback
  const lunchDinnerCombo = data.comboRules.find(combo => combo.mealIds.includes('lunch') && combo.mealIds.includes('dinner'))
  const sb = createAdminClient()
  const { error } = await sb.from('kitchen_meal_settings').upsert({
    organization_id: data.organizationId,
    breakfast_price: findPrice('breakfast', data.breakfastPrice),
    lunch_price: findPrice('lunch', data.lunchPrice),
    dinner_price: findPrice('dinner', data.dinnerPrice),
    combo_lunch_dinner_includes_breakfast: data.comboLunchDinnerIncludesBreakfast,
    lunch_dinner_discount_percent: lunchDinnerCombo?.discountPercent ?? data.lunchDinnerDiscountPercent,
    meal_options: data.mealOptions,
    combo_rules: data.comboRules,
    updated_by: data.updatedBy,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id' })
  if (error) throw new Error(error.message)
}

export async function updateMealPaymentSettings(data: {
  organizationId: string
  paymentMethods: string[]
  paymentInstructions: string | null
  paymentProvider: string | null
  gatewaySettings?: {
    cnpj: string | null
    legalName: string | null
    pixKeyType: string | null
    pixKey: string | null
    environment: string | null
    providerAccountId: string | null
    defaultCustomerId: string | null
    publicBaseUrl: string | null
    accessToken: string | null
    webhookToken: string | null
  }
  updatedBy: string
}) {
  const methods = data.paymentMethods.filter(method => ['manual', 'proof', 'gateway'].includes(method))
  const gatewayRequested = methods.includes('gateway')
  const sb = createAdminClient()

  const { data: currentSettings, error: settingsError } = await sb
    .from('kitchen_meal_settings')
    .select('payment_provider_settings')
    .eq('organization_id', data.organizationId)
    .maybeSingle()
  if (settingsError) throw new Error(settingsError.message)

  const providerSettings = (
    currentSettings?.payment_provider_settings
    && typeof currentSettings.payment_provider_settings === 'object'
    && !Array.isArray(currentSettings.payment_provider_settings)
  )
    ? currentSettings.payment_provider_settings as Record<string, unknown>
    : {}

  const cnpj = onlyDigits(data.gatewaySettings?.cnpj ?? providerSettings.cnpj)
  const legalName = normalizeText(data.gatewaySettings?.legalName ?? providerSettings.legal_name)
  const pixKeyType = normalizeText(data.gatewaySettings?.pixKeyType ?? providerSettings.pix_key_type)
  const pixKey = normalizeText(data.gatewaySettings?.pixKey ?? providerSettings.pix_key)
  const environment = ['sandbox', 'production'].includes(String(data.gatewaySettings?.environment ?? providerSettings.environment))
    ? String(data.gatewaySettings?.environment ?? providerSettings.environment)
    : 'sandbox'
  const providerAccountId = normalizeText(data.gatewaySettings?.providerAccountId ?? providerSettings.provider_account_id)
  const defaultCustomerId = normalizeText(data.gatewaySettings?.defaultCustomerId ?? providerSettings.default_customer_id)
  const publicBaseUrl = normalizeBaseUrl(data.gatewaySettings?.publicBaseUrl ?? providerSettings.public_base_url)
  const accessToken = normalizeText(data.gatewaySettings?.accessToken) || normalizeText(providerSettings.access_token)
  const webhookToken = normalizeText(data.gatewaySettings?.webhookToken)
    || normalizeText(providerSettings.webhook_token)
    || crypto.randomUUID()
  const publicWebhookReady = Boolean(publicBaseUrl && !/localhost|127\.0\.0\.1/.test(publicBaseUrl))
  const providerSupportsAutomaticPix = ['asaas', 'mercado_pago', 'pagseguro'].includes(data.paymentProvider ?? '')
  const gatewayConfigured = Boolean(providerSupportsAutomaticPix && cnpj.length >= 14 && pixKey && accessToken && webhookToken && defaultCustomerId && publicWebhookReady)
  const effectiveMethods = methods.filter(method => method !== 'gateway' || gatewayConfigured)
  const normalizedMethods = effectiveMethods.length > 0 ? [...new Set(effectiveMethods)] : ['manual']
  const paymentMode = normalizedMethods.includes('gateway')
    ? 'gateway'
    : normalizedMethods.includes('proof')
      ? 'proof'
      : 'manual'

  const { error } = await sb.from('kitchen_meal_settings').upsert({
    organization_id: data.organizationId,
    payment_mode: paymentMode,
    payment_methods: normalizedMethods,
    payment_instructions: data.paymentInstructions,
    payment_provider: data.paymentProvider,
    payment_provider_settings: {
      ...providerSettings,
      cnpj,
      legal_name: legalName,
      pix_key_type: pixKeyType,
      pix_key: pixKey,
      environment,
      provider_account_id: providerAccountId,
      default_customer_id: defaultCustomerId,
      public_base_url: publicBaseUrl,
      access_token: accessToken,
      webhook_token: webhookToken,
      access_token_configured: Boolean(accessToken),
      webhook_token_configured: Boolean(webhookToken),
      gateway_requested: gatewayRequested,
      gateway_configured: gatewayConfigured,
      gateway_status: gatewayConfigured
        ? 'configured'
        : gatewayRequested
          ? 'pending_configuration'
          : 'disabled',
    },
    updated_by: data.updatedBy,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id' })
  if (error) throw new Error(error.message)
}

async function createAutomaticPixCharge(data: {
  organizationId: string
  purchaseGroupId: string
  consumerName: string
  amount: number
  firstMealDate: string
}) {
  const sb = createAdminClient()
  const { data: settings, error } = await sb
    .from('kitchen_meal_settings')
    .select('payment_provider, payment_methods, payment_provider_settings')
    .eq('organization_id', data.organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)

  const methods = Array.isArray(settings?.payment_methods) ? settings.payment_methods : []
  const providerSettings = (
    settings?.payment_provider_settings
    && typeof settings.payment_provider_settings === 'object'
    && !Array.isArray(settings.payment_provider_settings)
  )
    ? settings.payment_provider_settings as Record<string, unknown>
    : {}

  if (!methods.includes('gateway') || providerSettings.gateway_configured !== true) {
    return
  }

  const provider = normalizeText(settings?.payment_provider)
  const accessToken = normalizeText(providerSettings.access_token)
  const customerId = normalizeText(providerSettings.default_customer_id)
  const environment: 'sandbox' | 'production' = providerSettings.environment === 'production' ? 'production' : 'sandbox'
  if (!accessToken || !customerId) return

  try {
    const chargeInput = {
      accessToken,
      environment,
      customerId,
      amount: data.amount,
      dueDate: data.firstMealDate,
      description: `Refeições SISGO - ${data.consumerName}`,
      externalReference: data.purchaseGroupId,
    }
    const charge = await createProviderPixCharge(provider, chargeInput)

    const { error: chargeError } = await sb.from('kitchen_meal_payment_charges').upsert({
      organization_id: data.organizationId,
      purchase_group_id: data.purchaseGroupId,
      provider,
      provider_charge_id: charge.providerChargeId,
      amount: data.amount,
      status: 'pending',
      pix_copy_paste: charge.pixCopyPaste,
      pix_qr_code_base64: charge.pixQrCodeBase64,
      invoice_url: charge.invoiceUrl,
      expires_at: charge.expiresAt,
      raw_response: charge.rawResponse,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,purchase_group_id' })
    if (chargeError) throw new Error(chargeError.message)
  } catch (chargeError) {
    await sb.from('kitchen_meal_payment_charges').upsert({
      organization_id: data.organizationId,
      purchase_group_id: data.purchaseGroupId,
      provider: provider || 'indefinido',
      amount: data.amount,
      status: 'failed',
      raw_response: {
        error: chargeError instanceof Error ? chargeError.message : 'Falha ao gerar Pix automático.',
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,purchase_group_id' })
  }
}

async function createProviderPixCharge(provider: string, input: {
  accessToken: string
  environment: 'sandbox' | 'production'
  customerId: string
  amount: number
  dueDate: string
  description: string
  externalReference: string
}): Promise<PixChargeResult> {
  if (provider === 'asaas') return createAsaasPixCharge(input)
  if (provider === 'mercado_pago') return createMercadoPagoPixCharge(input)
  if (provider === 'pagseguro') return createPagBankPixCharge(input)
  throw new Error('Este provedor ainda não tem adaptador de geração Pix automática.')
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function onlyDigits(value: unknown) {
  return normalizeText(value).replace(/\D/g, '')
}

function normalizeBaseUrl(value: unknown) {
  return normalizeText(value).replace(/\/+$/, '')
}

export async function createStockItem(data: {
  organizationId: string
  code: string
  name: string
  category: string | null
  unit: string
  minQuantity: number
  defaultLocation: string | null
  critical: boolean
  notes: string | null
  barcode?: string | null
  createdBy: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('kitchen_stock_items').insert({
    organization_id: data.organizationId,
    code:            data.code,
    name:            data.name,
    category:        data.category,
    unit:            data.unit,
    quantity:        0,
    min_quantity:    data.minQuantity,
    default_location: data.defaultLocation,
    critical:        data.critical,
    notes:           data.notes,
    barcode:         data.barcode ?? null,
    created_by:      data.createdBy,
  })
  if (error) throw new Error(error.message)
}

export async function updateStockItem(data: {
  id: string
  organizationId: string
  code: string
  name: string
  category: string | null
  unit: string
  minQuantity: number
  defaultLocation: string | null
  critical: boolean
  notes: string | null
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('kitchen_stock_items')
    .update({
      code: data.code,
      name: data.name,
      category: data.category,
      unit: data.unit,
      min_quantity: data.minQuantity,
      default_location: data.defaultLocation,
      critical: data.critical,
      notes: data.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.id)
    .eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

export async function createStockEntry(data: {
  organizationId: string
  itemId: string
  sourceType: string
  supplierName: string | null
  lotCode: string | null
  expirationDate: string | null
  quantity: number
  unitCost: number | null
  receivedAt: string
  location: string | null
  notes: string | null
  createdBy: string
}) {
  if (!data.itemId || data.quantity <= 0) return
  const sb = createAdminClient()
  const { data: item, error: itemError } = await sb
    .from('kitchen_stock_items')
    .select('quantity')
    .eq('id', data.itemId)
    .eq('organization_id', data.organizationId)
    .single()
  if (itemError) throw new Error(itemError.message)

  const { data: lot, error: lotError } = await sb.from('kitchen_stock_lots').insert({
    organization_id: data.organizationId,
    item_id: data.itemId,
    source_type: data.sourceType,
    supplier_name: data.supplierName,
    lot_code: data.lotCode,
    expiration_date: data.expirationDate,
    quantity_initial: data.quantity,
    quantity_current: data.quantity,
    unit_cost: data.unitCost,
    received_at: data.receivedAt,
    location: data.location,
    notes: data.notes,
    created_by: data.createdBy,
  }).select('id').single()
  if (lotError) throw new Error(lotError.message)

  const { error: movementError } = await sb.from('kitchen_stock_movements').insert({
    organization_id: data.organizationId,
    item_id: data.itemId,
    lot_id: lot.id,
    movement_type: 'entrada',
    quantity: data.quantity,
    unit_cost: data.unitCost,
    source_type: data.sourceType,
    location_to: data.location,
    reason: data.sourceType === 'doacao' ? 'Doação recebida' : 'Entrada de estoque',
    notes: data.notes,
    movement_date: data.receivedAt,
    created_by: data.createdBy,
  })
  if (movementError) throw new Error(movementError.message)

  const nextQuantity = Number(item.quantity ?? 0) + data.quantity
  const { error: updateError } = await sb.from('kitchen_stock_items')
    .update({ quantity: nextQuantity, updated_at: new Date().toISOString() })
    .eq('id', data.itemId)
    .eq('organization_id', data.organizationId)
  if (updateError) throw new Error(updateError.message)
}

export async function createStockMovement(data: {
  organizationId: string
  itemId: string
  movementType: 'saida' | 'perda' | 'ajuste' | 'transferencia' | 'doacao_saida'
  quantity: number
  locationFrom: string | null
  locationTo: string | null
  reason: string | null
  notes: string | null
  movementDate: string
  createdBy: string
}) {
  if (!data.itemId || data.quantity < 0) return
  const sb = createAdminClient()
  const { data: item, error: itemError } = await sb
    .from('kitchen_stock_items')
    .select('quantity')
    .eq('id', data.itemId)
    .eq('organization_id', data.organizationId)
    .single()
  if (itemError) throw new Error(itemError.message)

  const currentQuantity = Number(item.quantity ?? 0)
  const nextQuantity = data.movementType === 'ajuste'
    ? data.quantity
    : data.movementType === 'transferencia'
      ? currentQuantity
      : Math.max(0, currentQuantity - data.quantity)

  const { error: movementError } = await sb.from('kitchen_stock_movements').insert({
    organization_id: data.organizationId,
    item_id: data.itemId,
    movement_type: data.movementType,
    quantity: data.quantity,
    location_from: data.locationFrom,
    location_to: data.locationTo,
    reason: data.reason,
    notes: data.notes,
    movement_date: data.movementDate,
    created_by: data.createdBy,
  })
  if (movementError) throw new Error(movementError.message)

  const { error: updateError } = await sb.from('kitchen_stock_items')
    .update({ quantity: nextQuantity, updated_at: new Date().toISOString() })
    .eq('id', data.itemId)
    .eq('organization_id', data.organizationId)
  if (updateError) throw new Error(updateError.message)
}

export async function removeStockItem(data: {
  id: string
  organizationId: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('kitchen_stock_items')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', data.id)
    .eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

export async function createStockSupplier(data: {
  organizationId: string
  name: string
  description: string | null
  contactCountryCode: string
  contactPhone: string | null
  contactEmail: string | null
  address: string | null
  cnpj: string | null
  notes: string | null
  createdBy: string
}) {
  const name = data.name.trim()
  if (!name) return
  const contactCountryCode = normalizeSupplierCountry(data.contactCountryCode)
  const contactPhone = normalizeSupplierPhone(contactCountryCode, data.contactPhone)
  const contactEmail = normalizeSupplierEmail(data.contactEmail)
  const sb = createAdminClient()
  const { error } = await sb.from('kitchen_stock_suppliers').insert({
    organization_id: data.organizationId,
    name,
    description: data.description,
    contact_country_code: contactCountryCode,
    contact_phone: contactPhone,
    contact_email: contactEmail,
    address: data.address,
    cnpj: data.cnpj,
    notes: data.notes,
    created_by: data.createdBy,
  })
  if (error) throw new Error(error.message)
}

export async function updateStockSupplier(data: {
  id: string
  organizationId: string
  name: string
  description: string | null
  contactCountryCode: string
  contactPhone: string | null
  contactEmail: string | null
  address: string | null
  cnpj: string | null
  notes: string | null
}) {
  const name = data.name.trim()
  if (!data.id || !name) return
  const contactCountryCode = normalizeSupplierCountry(data.contactCountryCode)
  const contactPhone = normalizeSupplierPhone(contactCountryCode, data.contactPhone)
  const contactEmail = normalizeSupplierEmail(data.contactEmail)
  const sb = createAdminClient()
  const { error } = await sb.from('kitchen_stock_suppliers')
    .update({
      name,
      description: data.description,
      contact_country_code: contactCountryCode,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      address: data.address,
      cnpj: data.cnpj,
      notes: data.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.id)
    .eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

function normalizeSupplierCountry(value: string) {
  return supplierCountryCodes.has(value) ? value : 'BR'
}

function normalizeSupplierPhone(country: string, value: string | null) {
  const phone = (value ?? '').trim()
  if (!phone) return null
  const rawDigits = phone.replace(/\D/g, '')
  const dialDigits = (supplierDialCodes[country] ?? '').replace(/\D/g, '')
  const digits = dialDigits && rawDigits.startsWith(dialDigits) && rawDigits.length > 10
    ? rawDigits.slice(dialDigits.length)
    : rawDigits

  if (country === 'BR') {
    if (!(digits.length === 10 || digits.length === 11)) throw new Error('Informe um telefone brasileiro válido com DDD.')
    if (digits.length === 11 && digits[2] !== '9') throw new Error('Celular brasileiro deve ter 9 depois do DDD.')
    return digits.length === 11
      ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
      : `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  if (country === 'US') {
    if (digits.length !== 10) throw new Error('Informe um telefone dos Estados Unidos com 10 dígitos.')
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  if (country === 'PT') {
    if (digits.length !== 9) throw new Error('Informe um telefone de Portugal com 9 dígitos.')
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }

  if (digits.length < 6 || digits.length > 15) {
    throw new Error('Informe um telefone válido para o país selecionado.')
  }

  if (country === 'ZZ') return `+${rawDigits}`

  return `${supplierDialCodes[country] ?? ''} ${digits}`.trim()
}

function normalizeSupplierEmail(value: string | null) {
  const email = (value ?? '').trim().toLowerCase()
  if (!email) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.')
  return email
}

const supplierCountryCodes = new Set(PHONE_COUNTRIES.map(country => country.iso))
const supplierDialCodes = Object.fromEntries(PHONE_COUNTRIES.map(country => [country.iso, country.code])) as Record<string, string>

export async function removeStockSupplier(data: {
  id: string
  organizationId: string
}) {
  if (!data.id) return
  const sb = createAdminClient()
  const { error } = await sb.from('kitchen_stock_suppliers')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', data.id)
    .eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

export async function registerBarcode(data: {
  organizationId: string
  itemId: string
  barcode: string
  brand: string | null
  description: string | null
  packageQuantity: number
  packageUnit: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('kitchen_stock_barcodes').upsert({
    organization_id: data.organizationId,
    item_id: data.itemId,
    barcode: data.barcode,
    brand: data.brand,
    description: data.description,
    package_quantity: data.packageQuantity,
    package_unit: data.packageUnit,
  }, { onConflict: 'organization_id,barcode' })
  if (error) throw new Error(error.message)
}
