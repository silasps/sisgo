import { createAdminClient } from '@/lib/supabase/admin'

const MANAGEMENT_ROLES = ['superadmin', 'admin_base', 'lider_base', 'dh']

export async function getRecipientUserIds(
  eventType: string,
  orgId: string,
  schoolId?: string | null,
): Promise<string[]> {
  const supabase = createAdminClient()
  const userIds = new Set<string>()

  // Management always gets notified
  const { data: managers } = await supabase
    .from('organization_users')
    .select('user_id')
    .eq('organization_id', orgId)
    .in('role_id', MANAGEMENT_ROLES)

  for (const m of managers ?? []) userIds.add(m.user_id)

  // School-scoped events → notify school leaders
  if (schoolId && ['interest_form', 'student_application', 'staff_application'].includes(eventType)) {
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
      .in('role_id', ['manutencao', 'hospitalidade', 'secretaria'])

    for (const d of deptUsers ?? []) userIds.add(d.user_id)
  }

  return Array.from(userIds)
}
