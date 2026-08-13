import { createAdminClient } from '@/lib/supabase/admin'

const MANAGEMENT_ROLE_NAMES = ['superadmin', 'admin_base', 'lider_base', 'dh']
const SERVICE_ROLE_NAMES = ['manutencao', 'hospitalidade', 'secretaria']

export async function getRecipientUserIds(
  eventType: string,
  orgId: string,
  schoolId?: string | null,
): Promise<string[]> {
  const supabase = createAdminClient()
  const userIds = new Set<string>()

  // role_id em organization_users é um uuid (FK para roles.id), não o nome
  // do papel — precisamos resolver os nomes para ids antes de filtrar.
  const { data: roleRows } = await supabase
    .from('roles')
    .select('id, name')
    .in('name', [...new Set([...MANAGEMENT_ROLE_NAMES, ...SERVICE_ROLE_NAMES])])

  const roleIdsByName = new Map((roleRows ?? []).map(r => [r.name, r.id]))
  const roleIds = (names: string[]) => names.map(name => roleIdsByName.get(name)).filter((id): id is string => Boolean(id))

  // Management always gets notified
  const { data: managers } = await supabase
    .from('organization_users')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('active', true)
    .in('role_id', roleIds(MANAGEMENT_ROLE_NAMES))

  for (const m of managers ?? []) userIds.add(m.user_id)

  // School-scoped events → notify school leaders
  if (schoolId && ['interest_form', 'student_application', 'staff_application', 'student_auto_enrolled'].includes(eventType)) {
    const { data: leaders } = await supabase
      .from('school_leaders')
      .select('user_id')
      .eq('school_id', schoolId)

    for (const l of leaders ?? []) userIds.add(l.user_id)
  }

  // Ministry requests → notify ministry leaders
  if (eventType === 'ministry_request') {
    // Ministry ID comes from the payload, handled in processEvent
  }

  // Service requests → notify department heads
  if (eventType === 'service_request') {
    const { data: deptUsers } = await supabase
      .from('organization_users')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('active', true)
      .in('role_id', roleIds(SERVICE_ROLE_NAMES))

    for (const d of deptUsers ?? []) userIds.add(d.user_id)
  }

  return Array.from(userIds)
}
