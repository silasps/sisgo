'use server'

import { revalidatePath } from 'next/cache'
import { buildImportContext } from '@/lib/import-pessoas/context'
import { parseImportFile } from '@/lib/import-pessoas/parse'
import { validateImportRows } from '@/lib/import-pessoas/validate'
import { createImportedPerson } from '@/lib/import-pessoas/createPerson'
import { generateDefaultPassword } from '@/lib/import-pessoas/password'
import { sendImportWelcomeEmail } from '@/lib/email/sendImportWelcomeEmail'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ImportRowResult, ImportValidatedRow } from '@/lib/import-pessoas/types'

async function readUploadedFile(formData: FormData): Promise<Buffer | null> {
  const file = formData.get('arquivo')
  if (!(file instanceof File) || file.size === 0) return null
  return Buffer.from(await file.arrayBuffer())
}

export async function preverImportacaoPessoas(orgId: string, slug: string, formData: FormData): Promise<{ error: string } | { rows: ImportValidatedRow[] }> {
  const buffer = await readUploadedFile(formData)
  if (!buffer) return { error: 'Selecione um arquivo .xlsx preenchido.' }

  let raw
  try {
    raw = parseImportFile(buffer)
  } catch {
    return { error: 'Não foi possível ler esse arquivo. Confira se é o modelo .xlsx baixado nesta tela.' }
  }
  if (raw.length === 0) return { error: 'A planilha não tem nenhuma linha preenchida.' }

  const ctx = await buildImportContext(orgId, slug)
  const rows = await validateImportRows(raw, ctx)
  return { rows }
}

export async function confirmarImportacaoPessoas(orgId: string, slug: string, organizationName: string, formData: FormData): Promise<{ error: string } | { results: ImportRowResult[] }> {
  const buffer = await readUploadedFile(formData)
  if (!buffer) return { error: 'Selecione um arquivo .xlsx preenchido.' }

  let raw
  try {
    raw = parseImportFile(buffer)
  } catch {
    return { error: 'Não foi possível ler esse arquivo. Confira se é o modelo .xlsx baixado nesta tela.' }
  }

  const ctx = await buildImportContext(orgId, slug)
  const validated = await validateImportRows(raw, ctx)
  const enviarEmailAgora = formData.get('enviarEmailAgora') !== 'false'

  const db = createAdminClient()
  const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 })
  const authUsersByEmail = new Map(users.filter(u => u.email).map(u => [u.email!.toLowerCase(), u.id]))

  const results: ImportRowResult[] = []
  for (const row of validated) {
    if (row.status !== 'ok' || !row.parsed) {
      results.push({ rowNumber: row.raw.rowNumber, nome: row.raw.nome, email: row.raw.email, status: 'erro', message: row.errors.join(' ') })
      continue
    }
    const result = await createImportedPerson(ctx, row.parsed, row.raw.rowNumber, organizationName, authUsersByEmail, enviarEmailAgora)
    results.push(result)
  }

  revalidatePath(`/${slug}/pessoas`)
  revalidatePath(`/${slug}/pessoas/importar`)
  return { results }
}

export async function contarCredenciaisPendentes(orgId: string): Promise<number> {
  const db = createAdminClient()
  const { count } = await db.from('organization_users')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('active', true)
    .is('invite_sent_at', null)
  return count ?? 0
}

export async function enviarCredenciaisPendentes(orgId: string, slug: string, organizationName: string): Promise<{ error: string } | { enviados: number; erros: string[] }> {
  const db = createAdminClient()

  const { data: pendentes, error } = await db.from('organization_users')
    .select('id, user_id')
    .eq('organization_id', orgId)
    .eq('active', true)
    .is('invite_sent_at', null)
  if (error) return { error: error.message }
  if (!pendentes || pendentes.length === 0) return { enviados: 0, erros: [] }

  const userIds = pendentes.map(p => p.user_id)
  const { data: perfis } = await db.from('staff_profiles')
    .select('user_id, people(full_name)')
    .eq('organization_id', orgId)
    .in('user_id', userIds)
  const nomeByUserId = new Map(
    (perfis ?? []).map(p => [p.user_id as string, (p.people as unknown as { full_name: string } | null)?.full_name ?? 'Pessoa']),
  )

  let enviados = 0
  const erros: string[] = []
  const now = new Date().toISOString()

  for (const p of pendentes) {
    const { data: authUser, error: authError } = await db.auth.admin.getUserById(p.user_id)
    if (authError || !authUser.user?.email) {
      erros.push(`Usuário ${p.user_id}: sem email cadastrado no login.`)
      continue
    }
    const nome = nomeByUserId.get(p.user_id) ?? 'Pessoa'
    const password = generateDefaultPassword(nome)

    const { error: updateError } = await db.auth.admin.updateUserById(p.user_id, { password })
    if (updateError) {
      erros.push(`${nome}: ${updateError.message}`)
      continue
    }

    await sendImportWelcomeEmail({
      to: authUser.user.email,
      candidateName: nome,
      organizationId: orgId,
      organizationName,
      password,
      loginUrl: `https://www.sisgomission.com/${slug}`,
    })
    await db.from('organization_users').update({ invite_sent_at: now }).eq('id', p.id)
    enviados++
  }

  revalidatePath(`/${slug}/pessoas/importar`)
  return { enviados, erros }
}
