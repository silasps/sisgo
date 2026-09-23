'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePerson } from '@/lib/people/resolvePerson'
import { getPersonPrefillData } from '@/lib/people/getPersonPrefillData'
import { getCompletedInstitutionSchools } from '@/lib/people/getCompletedInstitutionSchools'
import { headers as nextHeaders } from 'next/headers'

export type StaffInviteResult = { url?: string; error?: string; emailWarning?: string; emailErrorDetail?: string }

type SendFormLinkParams = {
  slug: string
  token: string
  expiresAt: string
  organizationId: string
  ministryId: string | null
  fullName: string
  email: string | null
  language: string | null
  sendEmail?: boolean
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
  let emailErrorDetail: string | undefined
  if (params.sendEmail === false) {
    // usuário escolheu "copiar link" — não é falha, não gera aviso
  } else if (params.email) {
    const { data: orgRow } = await db.from('organizations').select('name, email, accent_color, staff_communication_languages').eq('id', params.organizationId).maybeSingle()
    let ministryName: string | null = null
    if (params.ministryId) {
      const { data: ministryRow } = await db.from('ministries').select('name').eq('id', params.ministryId).maybeSingle()
      ministryName = ministryRow?.name ?? null
    }
    // Sem idioma explícito (candidato não escolheu um na pré-inscrição), o
    // padrão segue os idiomas de comunicação configurados pela organização
    // em vez de cair direto para 'pt' fixo dentro de sendFormEmail.
    let language = params.language
    if (!language) {
      const orgStaffLanguages = (orgRow?.staff_communication_languages as string[] | null) ?? []
      language = orgStaffLanguages.includes('pt') ? 'pt' : (orgStaffLanguages[0] ?? 'pt')
    }
    // O CTA dentro do e-mail precisa abrir o formulário já no mesmo idioma
    // escolhido pra enviar — o link devolvido ao cliente (formUrl) fica sem
    // esse parâmetro pois o cliente já anexa o idioma escolhido nele.
    const formUrlForEmail = `${formUrl}?lang=${encodeURIComponent(language)}`
    const { sendFormEmail } = await import('@/lib/email/sendFormEmail')
    const emailResult = await sendFormEmail({
      to: params.email,
      candidateName: params.fullName,
      orgName: orgRow?.name ?? 'Organização',
      schoolName: ministryName ?? orgRow?.name ?? 'Organização',
      formUrl: formUrlForEmail,
      expiresAt: params.expiresAt,
      replyTo: orgRow?.email || 'noreply@sisgomission.com',
      language,
      organizationId: params.organizationId,
      accentColor: orgRow?.accent_color ?? null,
    })
    if (!emailResult.success) {
      emailWarning = emailResult.error === 'quota_atingida' ? 'quota_atingida' : 'email_falhou'
      emailErrorDetail = emailResult.error
    }
  } else {
    emailWarning = 'sem_email_candidato'
  }

  return { url: formUrl, emailWarning, emailErrorDetail }
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
  sendEmail?: boolean
}

// Cria (ou reaproveita) a people, gera a staff_applications com token e envia
// o e-mail com o link de /formulario-obreiro/[token]. Extraído de
// disponibilizarFormularioObreiro para ser reutilizável por qualquer fluxo
// que já tenha um staff_interest_forms pronto (público ou convite direto).
export async function createAndSendStaffApplication(params: CreateAndSendParams): Promise<StaffInviteResult> {
  const db = createAdminClient()
  const { organizationId, interestFormId, ministryId, schoolId, fullName, email, phone, language, leaderAcceptedBy } = params

  // Reaproveita a people já existente (por email ou telefone — quem chama
  // aqui não coleta CPF) em vez de duplicar quem já passou pelo sistema
  // antes, ativo ou não (ex-aluno virando obreiro, obreiro desligado que
  // volta anos depois etc.). Ver src/lib/people/resolvePerson.ts.
  let personId = params.personId ?? null
  if (!personId) {
    const resolved = await resolvePerson({ organizationId, email, phone })
    if (resolved) personId = resolved.personId
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

  // Se essa pessoa já tem dados pessoais conhecidos (foi aluna, já foi
  // obreira antes, veio de um import), pré-preenche a seção 2 (dados
  // pessoais) do formulário de obreiro — ela só revisa/confirma em vez de
  // digitar tudo de novo. Ver src/lib/people/getPersonPrefillData.ts.
  const s2Prefill = await getPersonPrefillData(personId)

  // Idem pra lista "Escolas ou especializações da instituição": se ela já
  // concluiu alguma escola desta organização (marcado pelo líder da escola,
  // ver getCompletedInstitutionSchools.ts), a lista já entra preenchida em
  // vez de pedir pra ela redigitar o que o sistema já sabe.
  const escolasInstituicao = await getCompletedInstitutionSchools(personId, organizationId)

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
        ...(s2Prefill || escolasInstituicao.length
          ? { s2: { ...s2Prefill, ...(escolasInstituicao.length ? { escolas_instituicao: JSON.stringify(escolasInstituicao) } : {}) } }
          : {}),
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
    sendEmail: params.sendEmail,
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
