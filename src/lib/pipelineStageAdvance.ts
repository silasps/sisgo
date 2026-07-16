import type { SupabaseClient } from '@supabase/supabase-js'

export type StageAdvance = {
  id: string
  from_stage: string
  to_stage: string
  reason: string
  advanced_by: string | null
  advanced_at: string
}

export async function getStageAdvances(
  sb: SupabaseClient, applicationType: 'obreiro' | 'aluno', applicationId: string
): Promise<StageAdvance[]> {
  const { data } = await sb
    .from('pipeline_stage_advances')
    .select('id, from_stage, to_stage, reason, advanced_by, advanced_at')
    .eq('application_type', applicationType)
    .eq('application_id', applicationId)
    .order('advanced_at', { ascending: false })
  return (data ?? []) as StageAdvance[]
}

export async function insertStageAdvance(sb: SupabaseClient, input: {
  organizationId: string
  applicationType: 'obreiro' | 'aluno'
  applicationId: string
  fromStage: string
  toStage: string
  reason: string
  userId: string | null
}) {
  await sb.from('pipeline_stage_advances').insert({
    organization_id: input.organizationId,
    application_type: input.applicationType,
    application_id: input.applicationId,
    from_stage: input.fromStage,
    to_stage: input.toStage,
    reason: input.reason,
    advanced_by: input.userId,
  })
}

// Nomes de quem avançou cada etapa, resolvidos de uma vez (evita N chamadas
// a auth.admin.getUserById).
export async function resolveAdvancerNames(sb: SupabaseClient, advances: StageAdvance[]): Promise<Map<string, string>> {
  const ids = [...new Set(advances.map(a => a.advanced_by).filter((id): id is string => !!id))]
  const names = new Map<string, string>()
  for (const id of ids) {
    const { data } = await sb.auth.admin.getUserById(id)
    names.set(id, (data.user?.user_metadata?.full_name as string | undefined) ?? data.user?.email ?? 'um administrador')
  }
  return names
}
