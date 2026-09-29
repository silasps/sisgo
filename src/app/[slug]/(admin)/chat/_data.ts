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

/**
 * Foto de perfil pra um lote de user_ids — vem do auth.users.user_metadata
 * (avatar_url, mesmo campo que /conta usa pra salvar), não de uma tabela.
 * Sem endpoint em lote no admin SDK: busca uma por uma, em paralelo; falha
 * de uma pessoa não derruba as outras (ela só fica sem foto, como se não
 * tivesse enviado nenhuma).
 */
export async function resolveAvatars(db: Admin, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const uniqueIds = [...new Set(userIds)]
  const results = await Promise.all(uniqueIds.map(async id => {
    try {
      const { data } = await db.auth.admin.getUserById(id)
      const url = data.user?.user_metadata?.avatar_url
      return typeof url === 'string' && url.trim().length > 0 ? [id, url] as const : null
    } catch {
      return null
    }
  }))
  return new Map(results.filter((r): r is readonly [string, string] => r !== null))
}
