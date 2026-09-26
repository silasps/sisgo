import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

/** Resolve nome de exibição (people.full_name) pra um lote de user_ids, via staff_profiles OU student_profiles. */
export async function resolveNames(db: Admin, orgId: string, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  type Row = { user_id: string; people: { full_name: string } | { full_name: string }[] | null }
  const [{ data: staffRows }, { data: studentRows }] = await Promise.all([
    db.from('staff_profiles').select('user_id, people(full_name)').eq('organization_id', orgId).in('user_id', userIds),
    db.from('student_profiles').select('user_id, people(full_name)').eq('organization_id', orgId).in('user_id', userIds),
  ])
  const map = new Map<string, string>()
  for (const row of [...(staffRows ?? []), ...(studentRows ?? [])] as Row[]) {
    const person = Array.isArray(row.people) ? row.people[0] : row.people
    if (person?.full_name) map.set(row.user_id, person.full_name)
  }
  return map
}
