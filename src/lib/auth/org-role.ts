import { createAdminClient } from '@/lib/supabase/admin'
import { asLooseClient } from '@/lib/supabase/loose-client'
import { getRolePreview } from '@/lib/role-preview'
import type { createClient } from '@/lib/supabase/server'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

type OrganizationUserRoleRow = {
  organization_id: string | null
  roles: { name: string } | { name: string }[] | null
}

function roleName(row: OrganizationUserRoleRow | undefined) {
  const roles = row?.roles
  if (Array.isArray(roles)) return roles[0]?.name ?? ''
  return roles?.name ?? ''
}

export async function getCurrentOrganizationRole(
  supabase: ServerSupabaseClient,
  userId: string,
  organizationId: string
) {
  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', userId)
    .eq('active', true)

  const rows = (orgUsers ?? []) as unknown as OrganizationUserRoleRow[]
  const superadminRow = rows.find(row => roleName(row) === 'superadmin')
  const supervisorRow = rows.find(row => roleName(row) === 'supervisor_bases')
  const currentOrgRow = rows.find(row => row.organization_id === organizationId)

  let realRole = roleName(superadminRow) || roleName(currentOrgRow) || roleName(supervisorRow)

  if (realRole === 'supervisor_bases' && supervisorRow) {
    const { data } = await asLooseClient(createAdminClient())
      .rpc('supervised_base_ids', { target_user_id: userId })

    const supervisedIds = new Set(
      ((data ?? []) as Array<{ organization_id: string }>).map(row => row.organization_id)
    )

    realRole = supervisedIds.has(organizationId) ? 'lider_base' : realRole
  }

  const preview = await getRolePreview(realRole)
  const displayRole = preview?.role ?? realRole

  const db = createAdminClient()
  const [{ data: orgData }, { data: orgUserData }, { data: staffProfile }] = await Promise.all([
    db.from('organizations').select('role_accumulations').eq('id', organizationId).single(),
    db.from('organization_users').select('extra_roles').eq('user_id', userId).eq('organization_id', organizationId).eq('active', true).single(),
    db.from('staff_profiles').select('person_id').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle(),
  ])
  const accumulations = (orgData?.role_accumulations as Record<string, string[]> | null) ?? {}
  const accumulatedRoles: string[] = accumulations[displayRole] ?? []
  const extraRoles: string[] = (orgUserData?.extra_roles as string[] | null) ?? []

  // Papéis vindos de ministério com `linked_role` (Hospitalidade/Secretaria/
  // DH/Cozinha/Manutenção) — mesmo cálculo de `linkedRoles` já usado em
  // layout.tsx pro menu, agora disponível pra qualquer página que precise
  // checar permissão da mesma forma (nunca só pelo papel principal, senão
  // quem tem esse acesso só por acumulação cai em notFound()).
  const personId = staffProfile?.person_id
  const [{ data: leaderLinkedData }, { data: memberLinkedData }] = await Promise.all([
    db.from('ministry_leaders').select('ministry_id, ministries(linked_role)').eq('user_id', userId).eq('organization_id', organizationId),
    personId
      ? db.from('ministry_members').select('ministry_id, ministries(linked_role)').eq('person_id', personId).eq('active', true)
      : Promise.resolve({ data: [] as Array<{ ministry_id: string; ministries: { linked_role: string | null } | null }> }),
  ])
  const linkedRoles = [...(leaderLinkedData ?? []), ...(memberLinkedData ?? [])]
    .map(r => (r.ministries as { linked_role: string | null } | null)?.linked_role)
    .filter((r): r is string => !!r)

  const allRoles = [displayRole, ...accumulatedRoles, ...extraRoles, ...linkedRoles]

  return {
    realRole,
    role: displayRole,
    preview,
    accumulatedRoles,
    extraRoles,
    linkedRoles,
    allRoles,
  }
}
