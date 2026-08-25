'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateReferenceForm, buildReferenceUrl } from '@/lib/staff/referenceForms'
import { basicImageSanity } from '@/lib/documents/basicImageSanity'
import { classifyDocument, type DocumentKind } from '@/lib/documents/classifyDocument'

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

const DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const DOCUMENT_KIND_BY_KEY: Record<string, DocumentKind> = {
  doc_foto: 'foto',
  doc_rg_frente: 'rg_frente',
  doc_rg_verso: 'rg_verso',
  doc_passaporte: 'passaporte',
  doc_certidao_casamento: 'certidao_casamento',
  doc_certidao_casamento_s10: 'certidao_casamento',
}

// Igual a salvarSecaoObreiro, mas pra seções que misturam campos de texto
// com upload de arquivo (03 — Família, quando casado: certidão de
// casamento; 10 — Documentos e Aceite Final): um File dentro de um
// FormData vira `{}` vazio se gravado direto como jsonb, então cada File
// precisa ser enviado pro Storage antes — só o metadado (path/name/tipo)
// vai pro form_data. Se a seção for reenviada sem escolher o arquivo de
// novo (voltar/avançar sem reselecionar), o metadado já salvo é mantido.
export async function salvarSecaoObreiroComArquivos(slug: string, token: string, section: number, formData: FormData) {
  if (!EDITABLE_SECTIONS.has(section)) return { error: 'Seção inválida.' }

  const result = await getEditableApplication(token, slug)
  if ('error' in result) return { error: result.error }

  const { app, sb } = result

  const existing = (app.form_data as Record<string, unknown>) ?? {}
  const existingSection = (existing[`s${section}`] as Record<string, unknown>) ?? {}
  const updatedSection: Record<string, unknown> = { ...existingSection }
  const toRemove: string[] = []

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (value.size === 0) continue
      if (!DOCUMENT_TYPES[value.type]) return { error: `Envie imagens (JPG, PNG ou WebP) ou PDF em "${key}".` }
      if (value.size > 10 * 1024 * 1024) return { error: 'Cada arquivo deve ter no máximo 10 MB.' }

      const fileBuffer = Buffer.from(await value.arrayBuffer())
      const sanity = await basicImageSanity(fileBuffer, value.type)
      if (!sanity.valid) return { error: sanity.reason }
      const kind = DOCUMENT_KIND_BY_KEY[key]
      if (kind) {
        const classification = await classifyDocument(fileBuffer, value.type, kind)
        if (!classification.valid) return { error: classification.reason ?? `A imagem enviada não parece ser o documento pedido ("${key}").` }
      }

      const path = `${app.organization_id}/${app.id}/${key}-${Date.now()}.${DOCUMENT_TYPES[value.type]}`
      const { error: uploadError } = await sb.storage.from('staff-application-documents').upload(path, fileBuffer, {
        contentType: value.type,
        upsert: false,
      })
      if (uploadError) return { error: `Não foi possível enviar "${key}". Tente novamente.` }

      const previous = existingSection[key] as { path?: string } | undefined
      updatedSection[key] = { path, name: value.name, type: value.type, size: value.size, uploaded_at: new Date().toISOString() }
      if (previous?.path) toRemove.push(previous.path)
    } else if (typeof value === 'string') {
      updatedSection[key] = value
    }
  }

  await sb.from('staff_applications').update({
    form_data: { ...existing, [`s${section}`]: updatedSection },
    current_section: Math.max(app.current_section ?? 1, section),
  }).eq('id', app.id)

  if (toRemove.length) await sb.storage.from('staff-application-documents').remove(toRemove)

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
