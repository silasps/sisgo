'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

const EDITABLE_SECTIONS = new Set([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])

async function getEditableApplication(token: string, slug: string) {
  const sb = createAdminClient()

  const { data: app } = await sb
    .from('school_applications')
    .select('id, organization_id, status, form_data, current_section, token_expires_at')
    .eq('token', token)
    .single()

  if (!app) return { error: 'Formulário não encontrado.' }
  if (app.status !== 'rascunho') return { error: 'Este formulário não pode mais ser editado.' }
  if (new Date(app.token_expires_at) < new Date()) return { error: 'Este link expirou.' }

  const { data: org } = await sb
    .from('organizations')
    .select('slug, active')
    .eq('id', app.organization_id)
    .single()

  if (!org?.active || org.slug !== slug) return { error: 'Formulário não encontrado.' }

  return { app, sb }
}

export async function salvarSecao(slug: string, token: string, section: number, data: Record<string, unknown>) {
  if (!EDITABLE_SECTIONS.has(section)) return { error: 'Seção inválida.' }

  const result = await getEditableApplication(token, slug)
  if ('error' in result) return { error: result.error }

  const { app, sb } = result

  const existing = (app.form_data as Record<string, unknown>) ?? {}
  const updated = {
    ...existing,
    [`s${section}`]: data,
  }

  await sb.from('school_applications').update({
    form_data: updated,
    current_section: Math.max(app.current_section ?? 1, section),
  }).eq('id', app.id)

  return { success: true }
}

export async function enviarFormulario(slug: string, token: string) {
  const result = await getEditableApplication(token, slug)
  if ('error' in result) return { error: result.error }

  const { app, sb } = result

  await sb.from('school_applications')
    .update({ status: 'enviado' })
    .eq('id', app.id)

  // Atualiza pré-inscrição para "em_analise" para visibilidade no admin
  const { data: appFull } = await sb
    .from('school_applications')
    .select('interest_form_id')
    .eq('id', app.id)
    .single()

  if (appFull?.interest_form_id) {
    await sb.from('school_interest_forms')
      .update({ status: 'em_analise' })
      .eq('id', appFull.interest_form_id)
  }

  return { success: true }
}

const RECEIPT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function anexarComprovante(slug: string, token: string, formData: FormData) {
  const file = formData.get('comprovante')
  if (!(file instanceof File) || file.size === 0) return { error: 'Selecione um arquivo.' }
  if (!RECEIPT_TYPES[file.type]) return { error: 'Envie uma imagem (JPG, PNG ou WebP) ou PDF.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'O arquivo deve ter no máximo 10 MB.' }

  const sb = createAdminClient()
  const { data: app } = await sb
    .from('school_applications')
    .select('id, organization_id, status, form_data')
    .eq('token', token)
    .single()

  if (!app || !['enviado', 'em_analise', 'aprovado'].includes(app.status)) {
    return { error: 'Envie o formulário antes de anexar o comprovante.' }
  }
  const { data: org } = await sb.from('organizations').select('slug, active').eq('id', app.organization_id).single()
  if (!org?.active || org.slug !== slug) return { error: 'Formulário não encontrado.' }

  const existingData = (app.form_data as Record<string, unknown>) ?? {}
  const previous = existingData.payment_receipt as { path?: string } | undefined
  const path = `${app.organization_id}/${app.id}/comprovante-${Date.now()}.${RECEIPT_TYPES[file.type]}`
  const { error: uploadError } = await sb.storage.from('payment-receipts').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) return { error: 'Não foi possível enviar o comprovante. Tente novamente.' }

  const paymentReceipt = { path, name: file.name, type: file.type, size: file.size, uploaded_at: new Date().toISOString() }
  const { error: updateError } = await sb.from('school_applications')
    .update({ form_data: { ...existingData, payment_receipt: paymentReceipt } })
    .eq('id', app.id)
  if (updateError) {
    await sb.storage.from('payment-receipts').remove([path])
    return { error: 'Não foi possível vincular o comprovante à inscrição.' }
  }
  if (previous?.path) await sb.storage.from('payment-receipts').remove([previous.path])

  return { success: true, fileName: file.name }
}

export async function gerarLinkReferencia(
  slug: string,
  applicationId: string,
  tipo: 'pastor' | 'amigo'
) {
  const sb = createAdminClient()

  const { data: app } = await sb
    .from('school_applications')
    .select('id, organization_id, status')
    .eq('id', applicationId)
    .single()

  if (!app) return { error: 'Aplicação não encontrada.' }
  if (!['enviado', 'em_analise', 'aprovado'].includes(app.status)) {
    return { error: 'Formulário ainda não foi enviado.' }
  }

  const { data: org } = await sb
    .from('organizations')
    .select('slug')
    .eq('id', app.organization_id)
    .single()

  if (!org || org.slug !== slug) return { error: 'Acesso negado.' }

  // Reutiliza a mesma referência se ainda pendente; se já foi respondida,
  // "gerar novo link" reabre a MESMA linha (não cria uma segunda) e limpa a
  // resposta anterior, já que o novo envio vai substituí-la.
  const { data: existing } = await sb
    .from('reference_forms')
    .select('id, token, status')
    .eq('school_application_id', applicationId)
    .eq('type', tipo)
    .maybeSingle()

  let token: string

  if (existing?.status === 'pendente') {
    token = existing.token
  } else if (existing) {
    const { randomBytes } = await import('node:crypto')
    token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: updated } = await sb
      .from('reference_forms')
      .update({ token, token_expires_at: expiresAt, status: 'pendente', form_data: null })
      .eq('id', existing.id)
      .select('token')
      .single()
    if (!updated) return { error: 'Não foi possível gerar o link.' }
    token = updated.token
  } else {
    const { data: created } = await sb
      .from('reference_forms')
      .insert({ school_application_id: applicationId, type: tipo })
      .select('token')
      .single()
    if (!created) return { error: 'Não foi possível gerar o link.' }
    token = created.token
  }

  const hdrs = await headers()
  const host = hdrs.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const url = `${protocol}://${host}/${slug}/referencia/${token}`

  return { url }
}
