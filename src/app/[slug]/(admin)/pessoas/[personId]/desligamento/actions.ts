'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { computeRetainedUntil } from '@/lib/staff/terminationPolicy'

// Desliga um obreiro: revoga o acesso na hora (mesmo mecanismo de
// "Desativar" — organization_users.active=false já derruba o papel em
// getCurrentOrganizationRole, barrando toda tela) e registra o
// desligamento com motivo e prazo de retenção. Não apaga/anonimiza nenhum
// dado agora — ver src/lib/staff/terminationPolicy.ts pro porquê.
export async function desligarObreiro(
  personId: string,
  orgId: string,
  terminatedBy: string,
  formData: FormData,
): Promise<{ error: string } | { ok: true; terminationId: string }> {
  const reasonCategory = formData.get('reason_category') as string
  const reasonText = ((formData.get('reason_text') as string) ?? '').trim() || null
  const hadPriorConversation = formData.get('had_prior_conversation') === 'on'
  const lastUnitLabel = ((formData.get('last_unit_label') as string) ?? '').trim() || null
  const leaderName = ((formData.get('leader_name') as string) ?? '').trim() || null

  if (!reasonCategory) return { error: 'Selecione um motivo.' }

  const db = createAdminClient()
  const { data: staffProfile } = await db
    .from('staff_profiles')
    .select('id, user_id')
    .eq('organization_id', orgId)
    .eq('person_id', personId)
    .maybeSingle()

  if (staffProfile?.user_id) {
    await db.from('organization_users')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('user_id', staffProfile.user_id)
      .eq('organization_id', orgId)
    await db.from('staff_profiles')
      .update({ active: false, left_at: new Date().toISOString().slice(0, 10) })
      .eq('id', staffProfile.id)
  }

  const { data: termination, error } = await db
    .from('staff_terminations')
    .insert({
      organization_id: orgId,
      person_id: personId,
      staff_profile_id: staffProfile?.id ?? null,
      terminated_by: terminatedBy,
      reason_category: reasonCategory,
      reason_text: reasonText,
      had_prior_conversation: hadPriorConversation,
      last_unit_label: lastUnitLabel,
      leader_name: leaderName,
      retained_until: computeRetainedUntil(),
    })
    .select('id')
    .single()

  if (error || !termination) return { error: error?.message ?? 'Não foi possível registrar o desligamento.' }
  return { ok: true, terminationId: termination.id }
}
