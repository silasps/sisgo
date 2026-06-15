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
  const [{ data: orgData }, { data: orgUserData }] = await Promise.all([
    db.from('organizations').select('role_accumulations').eq('id', organizationId).single(),
    db.from('organization_users').select('extra_roles').eq('user_id', userId).eq('organization_id', organizationId).eq('active', true).single(),
  ])
  const accumulations = (orgData?.role_accumulations as Record<string, string[]> | null) ?? {}
  const accumulatedRoles: string[] = accumulations[displayRole] ?? []
  const extraRoles: string[] = (orgUserData?.extra_roles as string[] | null) ?? []

  return {
    realRole,
    role: displayRole,
    preview,
    accumulatedRoles,
    extraRoles,
  }
}
