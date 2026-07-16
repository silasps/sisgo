'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateReferenceForm, buildReferenceUrl } from '@/lib/staff/referenceForms'

const EDITABLE_SECTIONS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

async function getEditableApplication(token: string, slug: string) {
  const sb = createAdminClient()

  const { data: app } = await sb
    .from('staff_applications')
    .select('id, organization_id, status, form_data, current_section, token_expires_at')
    .eq('token', token)
    .single()

  if (!app) return { error: 'Formulário não encontrado.' }
  if (app.status !== 'rascunho') return { error: 'Este formulário não pode mais ser editado.' }
  if (new Date(app.token_expires_at!) < new Date()) return { error: 'Este link expirou.' }

  const { data: org } = await sb
    .from('organizations')
    .select('slug, active')
    .eq('id', app.organization_id)
    .single()

  if (!org?.active || org.slug !== slug) return { error: 'Formulário não encontrado.' }

  return { app, sb }
}

export async function salvarSecaoObreiro(slug: string, token: string, section: number, data: Record<string, unknown>) {
  if (!EDITABLE_SECTIONS.has(section)) return { error: 'Seção inválida.' }

  const result = await getEditableApplication(token, slug)
  if ('error' in result) return { error: result.error }

  const { app, sb } = result

  const existing = (app.form_data as Record<string, unknown>) ?? {}
  const updated = {
    ...existing,
    [`s${section}`]: data,
  }

  await sb.from('staff_applications').update({
    form_data: updated,
    current_section: Math.max(app.current_section ?? 1, section),
  }).eq('id', app.id)

  return { success: true }
}

export async function enviarFormularioObreiro(slug: string, token: string) {
  const result = await getEditableApplication(token, slug)
  if ('error' in result) return { error: result.error }

  const { app, sb } = result

  // Vai direto para 'em_analise' — a partir do envio do formulário definitivo,
  // o acompanhamento é do DH (o líder passa a só visualizar), conforme
  // FLUXO_INSCRICAO_OBREIROS.md fase 3. Não precisa de um "enviar ao DH" manual.
  await sb.from('staff_applications')
    .update({ status: 'em_analise', reviewed_at: new Date().toISOString() })
    .eq('id', app.id)

  const { data: appFull } = await sb
    .from('staff_applications')
    .select('interest_form_id, ministry_id, school_id, organization_id, person_id, form_data')
    .eq('id', app.id)
    .single()

  if (appFull?.interest_form_id) {
    await sb.from('staff_interest_forms')
      .update({ status: 'em_analise' })
      .eq('id', appFull.interest_form_id)
  }

  // Pré-popula a checklist padrão de verificação de antecedentes (varia por
  // nacionalidade), pra já chegar pronta pro DH conferir.
  const formSections = app.form_data as Record<string, Record<string, string>> ?? {}
  if (appFull) {
    const { data: existingChecks } = await sb
      .from('background_checks')
      .select('id')
      .eq('staff_application_id', app.id)
      .limit(1)
    if (!existingChecks?.length) {
      const isBrasileiro = formSections.s2?.is_brasileiro !== 'nao'
      const checkTypes = isBrasileiro
        ? ['pf_federal', 'ssp_estadual', 'autodeclaracao_conduta', 'referencia_conduta_menores']
        : ['police_clearance_estrangeiro', 'autodeclaracao_conduta', 'referencia_conduta_menores']
      await sb.from('background_checks').insert(checkTypes.map(check_type => ({
        organization_id: appFull.organization_id,
        staff_application_id: app.id,
        person_id: appFull.person_id,
        check_type,
      })))
    }
  }

  await enviarPedidosDeReferencia(sb, slug, app.id, app.organization_id, appFull ?? null, formSections)

  return { success: true }
}

async function enviarPedidosDeReferencia(
  sb: ReturnType<typeof createAdminClient>,
  slug: string,
  staffApplicationId: string,
  organizationId: string,
  appFull: { ministry_id: string | null; school_id: string | null } | null,
  formData: Record<string, Record<string, string>>
) {
  const { data: org } = await sb.from('organizations').select('name, email').eq('id', organizationId).maybeSingle()
  let contextLabel = org?.name ?? 'JOCUM'
  if (appFull?.ministry_id) {
    const { data: ministry } = await sb.from('ministries').select('name').eq('id', appFull.ministry_id).maybeSingle()
    if (ministry?.name) contextLabel = ministry.name
  } else if (appFull?.school_id) {
    const { data: school } = await sb.from('schools').select('name').eq('id', appFull.school_id).maybeSingle()
    if (school?.name) contextLabel = school.name
  }
  const replyTo = org?.email || 'noreply@sisgomission.com'
  const candidateName = formData.s2?.nome || 'Obreiro'
  const { sendReferenceRequestEmail } = await import('@/lib/email/sendReferenceRequestEmail')

  const s4 = formData.s4
  if (s4?.pastor_email) {
    const ref = await getOrCreateReferenceForm(sb, staffApplicationId, 'pastor')
    if (ref.token) {
      const url = await buildReferenceUrl(slug, ref.token)
      await sendReferenceRequestEmail({
        to: s4.pastor_email,
        recommenderRole: 'pastor',
        candidateName,
        contextLabel,
        formUrl: url,
        expiresAt: ref.expiresAt,
        replyTo,
        organizationId,
      }).catch(() => {})
    }
  }

  const s5 = formData.s5
  const liderancaEmail = s5?.experiencia_recente_tipo === 'escola'
    ? s5?.escola_lider_email
    : s5?.experiencia_recente_tipo === 'missao'
      ? s5?.missao_lider_email
      : undefined
  if (liderancaEmail) {
    const ref = await getOrCreateReferenceForm(sb, staffApplicationId, 'lideranca_experiencia')
    if (ref.token) {
      const url = await buildReferenceUrl(slug, ref.token)
      const experienceLabel = s5.experiencia_recente_tipo === 'escola' ? (s5.escola_nome || contextLabel) : (s5.missao_organizacao || contextLabel)
      await sendReferenceRequestEmail({
        to: liderancaEmail,
        recommenderRole: 'lideranca_experiencia',
        candidateName,
        contextLabel: experienceLabel,
        formUrl: url,
        expiresAt: ref.expiresAt,
        replyTo,
        organizationId,
      }).catch(() => {})
    }
  }
}

export async function gerarLinkReferenciaObreiro(
  slug: string,
  staffApplicationId: string,
  tipo: 'pastor' | 'amigo' | 'lideranca_experiencia'
) {
  const sb = createAdminClient()

  const { data: app } = await sb
    .from('staff_applications')
    .select('id, organization_id, status')
    .eq('id', staffApplicationId)
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

  const result = await getOrCreateReferenceForm(sb, staffApplicationId, tipo)
  if (!result.token) return { error: result.error ?? 'Não foi possível gerar o link.' }

  const url = await buildReferenceUrl(slug, result.token)
  return { url }
}
