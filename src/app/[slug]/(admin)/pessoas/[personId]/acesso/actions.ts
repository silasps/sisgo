'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { generateDefaultPassword } from '@/lib/import-pessoas/password'
import { resolveOrCreateRoleId } from '@/lib/import-pessoas/roles'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CreatedAccess = {
  ok: true
  email: string
  password: string
  phone: string | null
  orgUserId: string
  whatsappMessage: string
}

// Completa o cadastro de alguém que entrou sem email (import em massa) —
// cria o login na hora, mas não envia o email de boas-vindas sozinho: devolve
// senha/telefone/mensagem pronta pra quem atribuiu mandar na hora por
// WhatsApp (ver CriarAcessoForm) — ou a pessoa cai no mesmo balde de
// "aguardando envio de credenciais" que o botão em pessoas/importar resolve
// em lote (por email), se ninguém mandar por WhatsApp.
export async function criarAcessoComEmail(
  personId: string,
  orgId: string,
  slug: string,
  formData: FormData,
): Promise<{ error: string } | CreatedAccess> {
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
  let orgUserId = ''
  if (roleId) {
    const { data: orgUser } = await db.from('organization_users')
      .insert({ organization_id: orgId, user_id: userId, role_id: roleId, active: true })
      .select('id').single()
    orgUserId = orgUser?.id ?? ''
  }

  // Mesma ordem de preferência usada em escolas/[id]/configuracoes/page.tsx
  // pro botão de WhatsApp: whatsapp primário > whatsapp > phone primário > phone.
  const { data: contacts } = await db.from('person_contacts')
    .select('type, value, is_primary').eq('person_id', personId).in('type', ['whatsapp', 'phone'])
  const rows = contacts ?? []
  const chosenPhone = rows.find(c => c.type === 'whatsapp' && c.is_primary)?.value
    ?? rows.find(c => c.type === 'whatsapp')?.value
    ?? rows.find(c => c.type === 'phone' && c.is_primary)?.value
    ?? rows.find(c => c.type === 'phone')?.value
    ?? null

  const { data: org } = await db.from('organizations').select('name').eq('id', orgId).single()
  const loginUrl = `https://www.sisgomission.com/${slug}`
  const whatsappMessage = [
    `Olá, ${person.full_name}! Seu acesso ao SISGO em ${org?.name ?? 'sua base'} foi criado.`,
    `Acesse: ${loginUrl}`,
    `E-mail: ${email}`,
    `Senha provisória: ${password}`,
    `No primeiro acesso você vai precisar trocar essa senha.`,
  ].join('\n')

  // Sem revalidatePath aqui — mesmo mirando OUTRAS rotas, qualquer
  // revalidatePath chamado durante essa Server Action disparava um refresh
  // que acabava batendo na própria página de Acesso (a que está em tela),
  // derrubando o card de sucesso com e-mail/senha/WhatsApp alguns segundos
  // depois. Essas páginas (pessoas, pessoas/importar) já usam cookies/auth
  // e renderizam dinâmico a cada acesso — não dependem de revalidatePath pra
  // mostrar dado fresco. O "Concluir" do CriarAcessoForm já faz
  // router.refresh() na própria página quando o usuário sai desse card.
  return { ok: true, email, password, phone: chosenPhone, orgUserId, whatsappMessage }
}

// Telefone que faltava pra habilitar o botão de WhatsApp logo após criar o
// acesso (ver CriarAcessoForm) — sem precisar sair da tela de Acesso.
export async function adicionarTelefonePessoa(
  personId: string,
  formData: FormData,
): Promise<{ error: string } | { ok: true; phone: string }> {
  const phone = ((formData.get('phone') as string) ?? '').replace(/\D/g, '')
  if (phone.length < 10 || phone.length > 13) return { error: 'Telefone inválido — use DDD + número.' }

  const db = createAdminClient()
  const { data: existing } = await db.from('person_contacts').select('id').eq('person_id', personId).eq('type', 'whatsapp').maybeSingle()
  if (existing) {
    await db.from('person_contacts').update({ value: phone, is_primary: true }).eq('id', existing.id)
  } else {
    await db.from('person_contacts').insert({ person_id: personId, type: 'whatsapp', value: phone, is_primary: true })
  }
  return { ok: true, phone }
}

// Marca que as credenciais já foram entregues (por WhatsApp aqui) — pra essa
// pessoa não aparecer de novo no lote de "credenciais pendentes" em
// pessoas/importar (que manda por email e regeneraria a senha padrão).
export async function marcarCredencialEnviada(orgUserId: string): Promise<void> {
  if (!orgUserId) return
  const db = createAdminClient()
  await db.from('organization_users').update({ invite_sent_at: new Date().toISOString() }).eq('id', orgUserId)
}

// Desfaz um "Criar acesso" — apaga o login (auth.users) e o e-mail
// cadastrado, devolvendo a pessoa pro estado "sem login" pra recriar o
// acesso do zero (útil em teste, ou quando o e-mail digitado foi errado).
// organization_users/school_leaders/ministry_leaders somem sozinhos — todos
// referenciam auth.users(id) on delete cascade; staff_profiles.user_id é
// on delete set null, por isso zeramos accepted_at manualmente aqui também.
export async function removerAcesso(personId: string, orgId: string): Promise<{ error?: string }> {
  const db = createAdminClient()
  const { data: staffProfile } = await db.from('staff_profiles')
    .select('id, user_id').eq('organization_id', orgId).eq('person_id', personId).maybeSingle()
  if (!staffProfile?.user_id) return {}

  const { error } = await db.auth.admin.deleteUser(staffProfile.user_id)
  if (error) return { error: error.message }

  await db.from('staff_profiles').update({ accepted_at: null }).eq('id', staffProfile.id)
  await db.from('person_contacts').delete().eq('person_id', personId).eq('type', 'email')
  return {}
}
