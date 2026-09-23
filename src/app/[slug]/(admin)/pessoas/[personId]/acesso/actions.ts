'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { generateDefaultPassword } from '@/lib/import-pessoas/password'
import { resolveOrCreateRoleId } from '@/lib/import-pessoas/roles'
import { revalidatePath } from 'next/cache'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Completa o cadastro de alguém que entrou sem email (import em massa) —
// cria o login na hora, mas não envia o email de boas-vindas: a pessoa cai
// no mesmo balde de "aguardando envio de credenciais" que o botão em
// pessoas/importar já resolve em lote.
export async function criarAcessoComEmail(
  personId: string,
  orgId: string,
  slug: string,
  formData: FormData,
): Promise<{ error: string } | { ok: true }> {
  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { error: `Email "${email}" não parece válido.` }

  const db = createAdminClient()

  const { data: existingContact } = await db.from('person_contacts').select('id').eq('type', 'email').eq('value', email).maybeSingle()
  if (existingContact) return { error: 'Já existe uma pessoa cadastrada com este email.' }

  const { data: person } = await db.from('people').select('full_name').eq('id', personId).eq('organization_id', orgId).single()
  if (!person) return { error: 'Pessoa não encontrada.' }

  const { data: staffProfile } = await db.from('staff_profiles').select('id, user_id').eq('organization_id', orgId).eq('person_id', personId).maybeSingle()
  if (!staffProfile) return { error: 'Essa pessoa não tem perfil de obreiro.' }
  if (staffProfile.user_id) return { error: 'Essa pessoa já tem login.' }

  const password = generateDefaultPassword(person.full_name)
  const { data: created, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: person.full_name, must_change_password: true },
  })
  if (authError || !created.user) return { error: authError?.message ?? 'Não foi possível criar o login.' }
  const userId = created.user.id

  await db.from('person_contacts').insert({ person_id: personId, type: 'email', value: email, is_primary: true })
  await db.from('staff_profiles').update({ user_id: userId }).eq('id', staffProfile.id)

  const { data: ministryLink } = await db.from('ministry_members').select('ministry_id').eq('person_id', personId).eq('active', true).limit(1).maybeSingle()
  const roleName = ministryLink ? 'obreiro_ministerio' : 'obreiro_eted'
  const roleId = await resolveOrCreateRoleId(db, roleName)
  if (roleId) {
    await db.from('organization_users').insert({ organization_id: orgId, user_id: userId, role_id: roleId, active: true })
  }

  revalidatePath(`/${slug}/pessoas/${personId}/acesso`)
  revalidatePath(`/${slug}/pessoas`)
  revalidatePath(`/${slug}/pessoas/importar`)
  return { ok: true }
}
