'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers as nextHeaders } from 'next/headers'

export type StaffInviteResult = { url?: string; error?: string; emailWarning?: string }

type SendFormLinkParams = {
  slug: string
  token: string
  expiresAt: string
  organizationId: string
  ministryId: string | null
  fullName: string
  email: string | null
  language: string | null
}

// Monta a URL de /formulario-obreiro/[token] e (re)envia o e-mail com o
// link. Chamado tanto ao criar a staff_applications quanto ao reaproveitar
// um token já existente (clique repetido em "Disponibilizar formulário" —
// serve como reenvio).
async function sendFormLink(params: SendFormLinkParams): Promise<StaffInviteResult> {
  const db = createAdminClient()
  const headersList = await nextHeaders()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const formUrl = `${protocol}://${host}/${params.slug}/formulario-obreiro/${params.token}`

  let emailWarning: string | undefined
  if (params.email) {
    const { data: orgRow } = await db.from('organizations').select('name, email').eq('id', params.organizationId).maybeSingle()
    let ministryName: string | null = null
    if (params.ministryId) {
      const { data: ministryRow } = await db.from('ministries').select('name').eq('id', params.ministryId).maybeSingle()
      ministryName = ministryRow?.name ?? null
    }
    const { sendFormEmail } = await import('@/lib/email/sendFormEmail')
    const emailResult = await sendFormEmail({
      to: params.email,
      candidateName: params.fullName,
      schoolName: ministryName ?? orgRow?.name ?? 'JOCUM',
      formUrl,
      expiresAt: params.expiresAt,
      replyTo: orgRow?.email || 'noreply@sisgomission.com',
      language: params.language,
      organizationId: params.organizationId,
    })
    if (!emailResult.success) {
      emailWarning = emailResult.error === 'quota_atingida' ? 'quota_atingida' : 'email_falhou'
    }
  } else {
    emailWarning = 'sem_email_candidato'
  }

  return { url: formUrl, emailWarning }
}

// Reenvia o link de um formulário já disponibilizado antes (reaproveita o
// token existente em vez de gerar uma nova staff_applications).
export async function resendStaffApplicationEmail(params: SendFormLinkParams): Promise<StaffInviteResult> {
  return sendFormLink(params)
}

type CreateAndSendParams = {
  slug: string
  organizationId: string
  interestFormId: string
  ministryId: string | null
  schoolId: string | null
  fullName: string
  email: string | null
  phone: string | null
  language: string | null
  personId?: string | null
  leaderAcceptedBy: string | null
}

// Cria (ou reaproveita) a people, gera a staff_applications com token e envia
// o e-mail com o link de /formulario-obreiro/[token]. Extraído de
// disponibilizarFormularioObreiro para ser reutilizável por qualquer fluxo
// que já tenha um staff_interest_forms pronto (público ou convite direto).
export async function createAndSendStaffApplication(params: CreateAndSendParams): Promise<StaffInviteResult> {
  const db = createAdminClient()
  const { organizationId, interestFormId, ministryId, schoolId, fullName, email, phone, language, leaderAcceptedBy } = params

  let personId = params.personId ?? null
  if (!personId && email) {
    const { data: contact } = await db.from('person_contacts')
      .select('person_id').eq('type', 'email').eq('value', email).maybeSingle()
    if (contact) personId = contact.person_id
  }
  if (!personId && !email && phone) {
    const { data: contact } = await db.from('person_contacts')
      .select('person_id').eq('type', 'phone').eq('value', phone).maybeSingle()
    if (contact) personId = contact.person_id
  }
  if (!personId) {
    const { data: person } = await db.from('people')
      .insert({ organization_id: organizationId, full_name: fullName })
      .select('id').single()
    personId = person?.id ?? null
    if (personId) {
      if (email) {
        await db.from('person_contacts').insert({ person_id: personId, type: 'email', value: email, is_primary: true })
      } else if (phone) {
        await db.from('person_contacts').insert({ person_id: personId, type: 'phone', value: phone, is_primary: true })
      }
    }
  }
  if (!personId) return { error: 'Não foi possível criar a pessoa.' }

  const { data: newApp } = await db
    .from('staff_applications')
    .insert({
      interest_form_id: interestFormId,
      organization_id: organizationId,
      person_id: personId,
      ministry_id: ministryId,
      school_id: schoolId,
      status: 'rascunho',
      form_data: {
        prefill: { nome: fullName, email, telefone: phone, idioma: language },
      },
      leader_accepted_by: leaderAcceptedBy,
      leader_accepted_at: new Date().toISOString(),
    })
    .select('token, token_expires_at')
    .single()
  if (!newApp) return { error: 'Não foi possível criar o formulário.' }

  return sendFormLink({
    slug: params.slug,
    token: newApp.token!,
    expiresAt: newApp.token_expires_at!,
    organizationId,
    ministryId,
    fullName,
    email,
    language,
  })
}

type DirectInviteParams = {
  slug: string
  organizationId: string
  ministryId: string | null
  schoolId: string | null
  fullName: string
  email: string | null
  phone: string | null
  message: string | null
  createdBy: string | null
}

// Fluxo 2: líder/DH já conversou com a pessoa fora do sistema e envia o
// formulário definitivo direto, sem pré-inscrição pública prévia. Cria um
// staff_interest_forms já em status 'formulario_enviado' (pula
// 'pendente'/'em_contato' — o alinhamento já aconteceu) para preservar toda
// a lógica de listagem/dedup existente que assume staff_applications
// vinculada a um interest_form_id.
export async function sendDirectStaffInvite(params: DirectInviteParams): Promise<StaffInviteResult> {
  const db = createAdminClient()

  const { data: form, error } = await db
    .from('staff_interest_forms')
    .insert({
      organization_id: params.organizationId,
      ministry_id: params.ministryId,
      school_id: params.schoolId,
      full_name: params.fullName,
      email: params.email?.trim() || '',
      phone: params.phone?.trim() || null,
      message: params.message?.trim() || null,
      status: 'formulario_enviado',
      created_by: params.createdBy,
    })
    .select('id')
    .single()
  if (error || !form) return { error: 'Não foi possível criar o convite.' }

  return createAndSendStaffApplication({
    slug: params.slug,
    organizationId: params.organizationId,
    interestFormId: form.id,
    ministryId: params.ministryId,
    schoolId: params.schoolId,
    fullName: params.fullName,
    email: params.email?.trim() || null,
    phone: params.phone?.trim() || null,
    language: null,
    leaderAcceptedBy: params.createdBy,
  })
}
