'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePerson } from '@/lib/people/resolvePerson'
import { getPersonPrefillData } from '@/lib/people/getPersonPrefillData'
import { headers as nextHeaders } from 'next/headers'

export type StudentInviteResult = { url?: string; error?: string; emailWarning?: string }

type DirectInviteParams = {
  slug: string
  organizationId: string
  schoolId: string
  classId: string | null
  fullName: string
  email: string | null
  phone: string | null
  message: string | null
  createdBy: string | null
}

// Espelha sendDirectStaffInvite (src/lib/staff/staffApplicationInvite.ts):
// líder/DH já conversou com o candidato fora do sistema e envia o
// formulário definitivo de aluno direto, sem pré-inscrição pública prévia.
// Cria um school_interest_forms já em 'formulario_enviado' (pula 'pendente')
// pra preservar a lógica de listagem/dedup existente, que assume
// school_applications vinculada a um interest_form_id.
export async function sendDirectStudentInvite(params: DirectInviteParams): Promise<StudentInviteResult> {
  const db = createAdminClient()

  // submitPreRegistration (pré-inscrição pública) guarda o e-mail em
  // minúsculas, e aprovar() (tipo 'pre_inscricao') compara em minúsculas na
  // hora de achar a pessoa em person_contacts — sem normalizar aqui também,
  // "João@Gmail.com" no convite não bateria com "joão@gmail.com" salvo ali.
  const email = params.email?.trim().toLowerCase() || null
  const phone = params.phone?.trim() || null

  // A aprovação só resolve a pessoa por e-mail em person_contacts — não lê
  // school_interest_forms.person_id. Sem uma people/person_contacts já
  // existente, a matrícula (enrollStudent) ficaria pendurada em silêncio
  // quando o líder aprovasse. Por isso, igual a createAndSendStaffApplication
  // (fluxo de obreiro), resolve ou cria a pessoa aqui, antes de mandar o link.
  let personId: string | null = null
  const resolved = await resolvePerson({ organizationId: params.organizationId, email, phone })
  if (resolved) {
    personId = resolved.personId
  } else {
    const { data: person } = await db.from('people')
      .insert({ organization_id: params.organizationId, full_name: params.fullName })
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

  const { data: form, error } = await db
    .from('school_interest_forms')
    .insert({
      organization_id: params.organizationId,
      school_id: params.schoolId,
      class_id: params.classId,
      person_id: personId,
      full_name: params.fullName,
      email: email ?? '',
      phone,
      message: params.message?.trim() || null,
      status: 'formulario_enviado',
      created_by: params.createdBy,
    })
    .select('id')
    .single()
  if (error || !form) return { error: 'Não foi possível criar o convite.' }

  // Se essa pessoa já tem dados pessoais conhecidos (foi obreira, já fez
  // outra escola, veio de um import), pré-preenche a seção de dados
  // pessoais do formulário — ela só revisa/confirma em vez de digitar tudo
  // de novo. Ver src/lib/people/getPersonPrefillData.ts.
  const s5Prefill = await getPersonPrefillData(personId)

  const { data: newApp } = await db
    .from('school_applications')
    .insert({
      interest_form_id: form.id,
      organization_id: params.organizationId,
      school_id: params.schoolId,
      class_id: params.classId,
      person_id: personId,
      status: 'rascunho',
      form_data: {
        prefill: { nome: params.fullName, email, telefone: phone },
        ...(s5Prefill ? { s5: s5Prefill } : {}),
      },
    })
    .select('token, token_expires_at')
    .single()
  if (!newApp) return { error: 'Não foi possível criar o formulário.' }

  const headersList = await nextHeaders()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const formUrl = `${protocol}://${host}/${params.slug}/formulario/${newApp.token}`

  let emailWarning: string | undefined
  if (email) {
    const [{ data: orgRow }, { data: escola }] = await Promise.all([
      db.from('organizations').select('name').eq('id', params.organizationId).maybeSingle(),
      db.from('schools').select('name, contact_email').eq('id', params.schoolId).maybeSingle(),
    ])
    if (escola?.contact_email) {
      const { sendFormEmail } = await import('@/lib/email/sendFormEmail')
      const emailResult = await sendFormEmail({
        to: email,
        candidateName: params.fullName,
        orgName: orgRow?.name ?? 'Organização',
        schoolName: escola.name,
        formUrl,
        expiresAt: newApp.token_expires_at!,
        replyTo: escola.contact_email,
        language: null,
        organizationId: params.organizationId,
        schoolId: params.schoolId,
      })
      if (!emailResult.success) {
        emailWarning = emailResult.error === 'quota_atingida' ? 'quota_atingida' : 'email_falhou'
      }
    } else {
      emailWarning = 'sem_email_eted'
    }
  } else {
    emailWarning = 'sem_email_candidato'
  }

  // Link curto (/l/<código>) pra quem for copiar/mandar por WhatsApp — o
  // e-mail automático (acima) continua com a URL completa.
  const { getOrCreateShortLink } = await import('@/lib/shortLinks')
  const shortUrl = await getOrCreateShortLink({
    organizationId: params.organizationId,
    targetPath: `/${params.slug}/formulario/${newApp.token}`,
    createdBy: null,
  })

  return { url: shortUrl, emailWarning }
}
