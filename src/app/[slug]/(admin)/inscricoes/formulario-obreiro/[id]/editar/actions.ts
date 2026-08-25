'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { basicImageSanity } from '@/lib/documents/basicImageSanity'
import { classifyDocument, type DocumentKind } from '@/lib/documents/classifyDocument'

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
  doc_certidao_casamento_s10: 'certidao_casamento',
}

async function assertCanEdit(organizationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)

  const memberships = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
  const role = memberships.find(m => m.roles?.name === 'superadmin')?.roles?.name
    ?? memberships.find(m => m.organization_id === organizationId)?.roles?.name
    ?? ''
  if (!['superadmin', 'admin_base', 'lider_base', 'dh', 'lider_eted', 'lider_ministerio'].includes(role)) throw new Error('forbidden')
}

// Deixa o DH/líder anexar (ou substituir) um documento da Seção 10 direto
// pela tela de edição — mesmo padrão de anexarDocumentoAdmin
// (inscricoes/formulario/[id]/editar/actions.ts), mas pro obreiro: bucket
// staff-application-documents, grava sempre em form_data.s10.{key} (a
// Seção 10 sempre existe no formulário, diferente da Seção 03 que só
// mostra o campo de certidão quando casado — um upload manual do admin
// não deveria depender disso).
export async function anexarDocumentoObreiroAdmin(
  params: { slug: string; organizationId: string; applicationId: string; key: string },
  formData: FormData
) {
  await assertCanEdit(params.organizationId)
  const sb = createAdminClient()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Selecione um arquivo.' }
  if (!DOCUMENT_TYPES[file.type]) return { error: 'Envie uma imagem (JPG, PNG ou WebP) ou PDF.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'O arquivo deve ter no máximo 10 MB.' }

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const sanity = await basicImageSanity(fileBuffer, file.type)
  if (!sanity.valid) return { error: sanity.reason }
  const kind = DOCUMENT_KIND_BY_KEY[params.key]
  if (kind) {
    const classification = await classifyDocument(fileBuffer, file.type, kind)
    if (!classification.valid) return { error: classification.reason ?? 'Essa imagem não parece ser o documento pedido.' }
  }

  const { data: app } = await sb
    .from('staff_applications')
    .select('id, form_data')
    .eq('id', params.applicationId)
    .eq('organization_id', params.organizationId)
    .single()
  if (!app) return { error: 'Inscrição não encontrada.' }

  const existing = (app.form_data as Record<string, unknown>) ?? {}
  const existingS10 = (existing.s10 as Record<string, { path?: string }>) ?? {}
  const previous = existingS10[params.key]

  const path = `${params.organizationId}/${app.id}/${params.key}-${Date.now()}.${DOCUMENT_TYPES[file.type]}`
  const { error: uploadError } = await sb.storage.from('staff-application-documents').upload(path, fileBuffer, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) return { error: 'Não foi possível enviar o arquivo. Tente novamente.' }

  const updatedS10 = {
    ...existingS10,
    [params.key]: { path, name: file.name, type: file.type, size: file.size, uploaded_at: new Date().toISOString() },
  }
  await sb.from('staff_applications').update({ form_data: { ...existing, s10: updatedS10 } }).eq('id', app.id)
  if (previous?.path) await sb.storage.from('staff-application-documents').remove([previous.path])

  revalidatePath(`/${params.slug}/inscricoes/formulario-obreiro/${app.id}`)
  revalidatePath(`/${params.slug}/inscricoes/formulario-obreiro/${app.id}/editar`)
  return { success: true }
}
