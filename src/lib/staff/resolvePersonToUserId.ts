import { createAdminClient } from '@/lib/supabase/admin'
import { generateDefaultPassword } from '@/lib/import-pessoas/password'
import { resolveOrCreateRoleId } from '@/lib/import-pessoas/roles'

type AdminClient = ReturnType<typeof createAdminClient>

// Resolve uma PESSOA pro user_id que vai virar líder — busca entre todo
// mundo cadastrado na base, não só quem já tem login. Sem login ainda: cria
// a conta usando o e-mail já no cadastro da pessoa (mesmo padrão de
// senha/criação do import em massa, ver lib/import-pessoas). Sem e-mail
// cadastrado, não tem como criar login (é o identificador em auth.users) —
// devolve erro pra quem atribuiu completar o cadastro primeiro.
//
// Compartilhado entre atribuição de líder de escola e de ministério — antes
// vivia só em escolas/[id]/actions.ts. `defaultRoleName` é só o papel de
// entrada pra quem ainda não tinha nenhum vínculo com a organização; quem
// chama ajusta o papel final (grantSchoolLeaderRole/grantMinistryLeaderRole)
// logo em seguida.
export async function resolvePersonToUserId(
  sb: AdminClient,
  orgId: string,
  personId: string,
  defaultRoleName: string,
): Promise<{ userId: string } | { error: string }> {
  // Lista, não maybeSingle(): há pessoas com staff_profiles duplicados na
  // mesma base (cadastros importados/refeitos, registros nunca são
  // apagados) — com maybeSingle() a consulta quebra quando há mais de um.
  const { data: profiles } = await sb.from('staff_profiles')
    .select('id, user_id').eq('organization_id', orgId).eq('person_id', personId)
  const profile = (profiles ?? []).find(p => p.user_id) ?? profiles?.[0]
  if (profile?.user_id) return { userId: profile.user_id }

  const { data: person } = await sb.from('people').select('full_name').eq('id', personId).single()
  if (!person) return { error: 'Pessoa não encontrada.' }

  const { data: contact } = await sb.from('person_contacts')
    .select('value').eq('person_id', personId).eq('type', 'email')
    .order('is_primary', { ascending: false }).limit(1).maybeSingle()
  if (!contact?.value) {
    return { error: `${person.full_name} não tem e-mail cadastrado — adicione um e-mail no cadastro dela antes de atribuir como líder.` }
  }

  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 })
  let userId = users.find(u => u.email?.toLowerCase() === contact.value.toLowerCase())?.id

  if (!userId) {
    const { data: created, error } = await sb.auth.admin.createUser({
      email: contact.value,
      password: generateDefaultPassword(person.full_name),
      email_confirm: true,
      user_metadata: { full_name: person.full_name, must_change_password: true },
    })
    if (error || !created.user) return { error: error?.message ?? 'Não foi possível criar o login.' }
    userId = created.user.id
  }

  const { data: existingOrgUser } = await sb.from('organization_users')
    .select('id').eq('user_id', userId).eq('organization_id', orgId).maybeSingle()
  if (!existingOrgUser) {
    const roleId = await resolveOrCreateRoleId(sb, defaultRoleName)
    if (roleId) await sb.from('organization_users').insert({ user_id: userId, organization_id: orgId, role_id: roleId, active: true })
  }

  if (profile) {
    await sb.from('staff_profiles').update({ user_id: userId, accepted_at: new Date().toISOString() }).eq('id', profile.id)
  } else {
    await sb.from('staff_profiles').insert({
      organization_id: orgId, person_id: personId, user_id: userId, active: true, accepted_at: new Date().toISOString(),
    })
  }

  return { userId }
}
