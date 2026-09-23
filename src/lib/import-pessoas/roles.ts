import { createAdminClient } from '@/lib/supabase/admin'

// Alguns papéis (ex. 'aluno') nunca foram inseridos em `roles` porque,
// até o import em massa existir, nenhum fluxo criava login pra aluno —
// mesmo padrão de upsert-por-nome já usado em obreiros/actions.ts
// (resolveRole) pros papéis lider_eted/obreiro_eted.
const ROLE_LABELS: Record<string, string> = {
  aluno: 'Aluno',
  obreiro_eted: 'Obreiro de Escola',
  obreiro_ministerio: 'Obreiro de Ministério',
}

export async function resolveOrCreateRoleId(db: ReturnType<typeof createAdminClient>, roleName: string): Promise<string | null> {
  const { data: existing } = await db.from('roles').select('id').eq('name', roleName).maybeSingle()
  if (existing) return existing.id

  const label = ROLE_LABELS[roleName] ?? roleName
  const { data: created } = await db
    .from('roles')
    .upsert({ name: roleName, label }, { onConflict: 'name' })
    .select('id')
    .single()

  return created?.id ?? null
}
