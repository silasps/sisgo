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

  // Reutiliza link existente se ainda pendente
  const { data: existing } = await sb
    .from('reference_forms')
    .select('token')
    .eq('school_application_id', applicationId)
    .eq('type', tipo)
    .eq('status', 'pendente')
    .maybeSingle()

  let token: string

  if (existing) {
    token = existing.token
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
