'use server'

import { createAdminClient } from '@/lib/supabase/admin'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DOCUMENT_EXT: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
}

// Editar nome — direto em people.full_name. Não mexe em nada mais (o nome
// em staff_profiles/organization_users é só o id da pessoa, lido sempre
// via join; não há cópia pra sincronizar).
export async function atualizarNomePessoa(
  personId: string,
  formData: FormData,
): Promise<{ error: string } | { ok: true }> {
  const fullName = ((formData.get('full_name') as string) ?? '').trim()
  if (!fullName) return { error: 'Nome não pode ficar em branco.' }
  const db = createAdminClient()
  await db.from('people').update({ full_name: fullName }).eq('id', personId)
  return { ok: true }
}

// Editar contato geral (não é o e-mail de LOGIN — esse é o atualizarEmailLogin
// em pessoas/[id]/acesso/actions.ts; aqui é o contato cadastral da pessoa,
// que pode nem ter login).
export async function atualizarContatoPessoa(
  personId: string,
  formData: FormData,
): Promise<{ error: string } | { ok: true }> {
  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  const phone = ((formData.get('phone') as string) ?? '').replace(/\D/g, '')

  if (email && !EMAIL_RE.test(email)) return { error: `Email "${email}" não parece válido.` }
  if (phone && (phone.length < 10 || phone.length > 13)) return { error: 'Telefone inválido — use DDD + número.' }

  const db = createAdminClient()
  const upsertContact = async (type: 'email' | 'whatsapp', value: string) => {
    const { data: existing } = await db.from('person_contacts').select('id').eq('person_id', personId).eq('type', type).maybeSingle()
    if (existing) await db.from('person_contacts').update({ value, is_primary: true }).eq('id', existing.id)
    else await db.from('person_contacts').insert({ person_id: personId, type, value, is_primary: true })
  }

  if (email) await upsertContact('email', email)
  if (phone) await upsertContact('whatsapp', phone)
  return { ok: true }
}

// Substitui um documento (foto, RG, etc.) dentro do form_data da inscrição
// mais recente da pessoa — mesmo bucket/formato que o próprio formulário
// público usa (staff-application-documents), pra ficar tudo no mesmo lugar
// que o DH já sabe abrir.
export async function substituirDocumentoPessoa(
  personId: string,
  orgId: string,
  formData: FormData,
): Promise<{ error: string } | { ok: true }> {
  const section = formData.get('section') as string
  const key = formData.get('key') as string
  const file = formData.get('file') as File | null
  if (!section || !key || !file || file.size === 0) return { error: 'Selecione um arquivo.' }

  const ext = DOCUMENT_EXT[file.type]
  if (!ext) return { error: 'Formato não aceito — use PDF, JPG, PNG ou WEBP.' }

  const db = createAdminClient()
  const { data: app } = await db
    .from('staff_applications')
    .select('id, form_data')
    .eq('organization_id', orgId)
    .eq('person_id', personId)
    .order('applied_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!app) return { error: 'Essa pessoa não tem inscrição de obreiro pra anexar documento.' }

  const path = `${personId}/${key}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await db.storage.from('staff-application-documents').upload(path, buffer, { contentType: file.type })
  if (uploadError) return { error: 'Não foi possível enviar o arquivo. Tente novamente.' }

  const formDataJson = (app.form_data as Record<string, unknown>) ?? {}
  const sectionData = (formDataJson[section] as Record<string, unknown>) ?? {}
  const oldValue = sectionData[key] as { path?: string } | undefined

  const updated = {
    ...formDataJson,
    [section]: {
      ...sectionData,
      [key]: { path, name: file.name, type: file.type, size: file.size, uploaded_at: new Date().toISOString() },
    },
  }
  await db.from('staff_applications').update({ form_data: updated }).eq('id', app.id)

  if (oldValue?.path) await db.storage.from('staff-application-documents').remove([oldValue.path])
  return { ok: true }
}
