'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

const EDITABLE_SECTIONS = new Set([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])

// Só usado no fluxo de matrícula direta de seminário (sem pré-inscrição
// prévia) — resolve/cria a pessoa a partir do que ela mesma preencheu no
// formulário (s1.email, s5.nome, s5.celular), mesmo padrão de
// submitPreRegistration (escola/[schoolSlug]/actions.ts).
async function findOrCreatePersonFromApplication(
  sb: ReturnType<typeof createAdminClient>,
  organizationId: string,
  formData: Record<string, unknown>,
): Promise<{ personId: string; fullName: string } | null> {
  const s1 = (formData.s1 as Record<string, string> | undefined) ?? {}
  const s5 = (formData.s5 as Record<string, string> | undefined) ?? {}
  const email = (s1.email ?? '').trim().toLowerCase()
  const fullName = (s5.nome ?? '').trim()
  const phone = (s5.celular ?? '').trim()
  if (!email || !fullName) return null

  const { data: existingPerson } = await sb
    .from('people')
    .select('id, person_contacts!inner(type, value)')
    .eq('organization_id', organizationId)
    .eq('person_contacts.type', 'email')
    .eq('person_contacts.value', email)
    .maybeSingle()

  if (existingPerson) return { personId: existingPerson.id, fullName }

  const { data: newPerson } = await sb
    .from('people')
    .insert({ organization_id: organizationId, full_name: fullName })
    .select('id')
    .single()
  if (!newPerson) return null

  const contacts: { person_id: string; type: string; value: string; is_primary: boolean }[] = [
    { person_id: newPerson.id, type: 'email', value: email, is_primary: true },
  ]
  if (phone) contacts.push({ person_id: newPerson.id, type: 'phone', value: phone, is_primary: false })
  await sb.from('person_contacts').insert(contacts)

  return { personId: newPerson.id, fullName }
}

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
    .select('interest_form_id, organization_id, school_id, class_id, form_data')
    .eq('id', app.id)
    .single()

  if (appFull?.interest_form_id) {
    await sb.from('school_interest_forms')
      .update({ status: 'em_analise' })
      .eq('id', appFull.interest_form_id)
  } else if (appFull?.class_id) {
    // Sem pré-inscrição prévia = veio do link único de matrícula direta
    // (hoje só seminário): o candidato nunca preenche um formulário curto
    // separado, mas a partir daqui o fluxo é IDÊNTICO ao de uma ETED —
    // aparece em Inscrições e precisa do DH/líder clicar "Aceitar aluno"
    // pra virar aluno de fato. Por isso cria o interest_form só agora, na
    // hora do envio, e linka de volta — reaproveita a mesma tela/ação de
    // aprovação já existente (aprovar() em inscricoes/page.tsx) sem
    // precisar duplicar nada.
    const { data: school } = await sb.from('schools').select('school_type').eq('id', appFull.school_id).single()
    if (school?.school_type === 'seminario') {
      const formData = (appFull.form_data as Record<string, unknown>) ?? {}
      const person = await findOrCreatePersonFromApplication(sb, appFull.organization_id, formData)
      if (person) {
        const s1 = (formData.s1 as Record<string, string> | undefined) ?? {}
        const s5 = (formData.s5 as Record<string, string> | undefined) ?? {}
        const { data: interestForm } = await sb.from('school_interest_forms').insert({
          organization_id: appFull.organization_id,
          school_id: appFull.school_id,
          class_id: appFull.class_id,
          person_id: person.personId,
          full_name: person.fullName,
          email: (s1.email ?? '').trim().toLowerCase(),
          phone: (s5.celular ?? '').trim() || null,
          status: 'em_analise',
        }).select('id').single()
        if (interestForm) {
          await sb.from('school_applications').update({ interest_form_id: interestForm.id }).eq('id', app.id)
        }
      }
    }
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

  if (!app || !['rascunho', 'enviado', 'em_analise', 'aprovado'].includes(app.status)) {
    return { error: 'Formulário não encontrado.' }
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
