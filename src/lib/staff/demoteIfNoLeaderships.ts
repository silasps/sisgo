import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOrCreateRoleId } from '@/lib/import-pessoas/roles'

type AdminClient = ReturnType<typeof createAdminClient>

// Chamado depois que uma pessoa deixa de ser líder de uma escola/ministério
// (removida, ou substituída por outro líder em "Atribuir líder") — sem
// isso, grantSchoolLeaderRole/grantMinistryLeaderRole promovem o papel
// principal pra lider_eted/lider_ministerio na hora de virar líder, mas
// nada reverte isso quando a liderança acaba, e a etiqueta "Líder de X"
// fica presa pra sempre (bug reportado: removeu a liderança, continuou
// aparecendo como líder).
//
// Só mexe se: (a) a pessoa não lidera mais NADA (nenhuma escola nem
// ministério — pode liderar várias coisas ao mesmo tempo, então só revertia
// se perdeu a última) e (b) o papel principal ainda É literalmente
// lider_eted/lider_ministerio (se alguém trocou o papel dela por outro
// motivo depois, não mexe — não é essa função que decidiu aquele papel).
export async function demoteIfNoLeaderships(sb: AdminClient, orgId: string, userId: string): Promise<void> {
  const [{ count: schoolLeaderCount }, { count: ministryLeaderCount }] = await Promise.all([
    sb.from('school_leaders').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('user_id', userId),
    sb.from('ministry_leaders').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('user_id', userId),
  ])
  if ((schoolLeaderCount ?? 0) > 0 || (ministryLeaderCount ?? 0) > 0) return

  const { data: orgUser } = await sb.from('organization_users')
    .select('id, roles(name)').eq('user_id', userId).eq('organization_id', orgId).maybeSingle()
  const currentRoleName = (orgUser?.roles as unknown as { name: string } | null)?.name
  if (currentRoleName !== 'lider_eted' && currentRoleName !== 'lider_ministerio') return

  const { data: profile } = await sb.from('staff_profiles')
    .select('id, person_id').eq('organization_id', orgId).eq('user_id', userId).maybeSingle()
  if (!profile) return

  const [{ count: schoolStaffCount }, { count: ministryMemberCount }] = await Promise.all([
    sb.from('school_staff').select('*', { count: 'exact', head: true }).eq('person_id', profile.person_id).eq('active', true),
    sb.from('ministry_members').select('*', { count: 'exact', head: true }).eq('person_id', profile.person_id).eq('active', true),
  ])

  // Sem vínculo nenhum (nem obreiro de escola, nem de ministério) não dá
  // pra saber qual papel seria o certo — deixa como está em vez de chutar.
  const fallbackRoleName = (ministryMemberCount ?? 0) > 0
    ? 'obreiro_ministerio'
    : (schoolStaffCount ?? 0) > 0 ? 'obreiro_eted' : null
  if (!fallbackRoleName) return

  const roleId = await resolveOrCreateRoleId(sb, fallbackRoleName)
  if (!roleId) return

  await sb.from('organization_users').update({ role_id: roleId, updated_at: new Date().toISOString() }).eq('id', orgUser!.id)
  await sb.from('staff_profiles').update({ role_title: null, updated_at: new Date().toISOString() }).eq('id', profile.id)
}
