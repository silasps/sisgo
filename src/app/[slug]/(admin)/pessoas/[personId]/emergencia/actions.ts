'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { REASON_LABELS } from './constants'

export async function requestEmergencyAccess(
  personId: string,
  orgId: string,
  slug: string,
  formData: FormData,
): Promise<{ error: string } | { ok: true }> {
  const reasonCategory = formData.get('reason_category') as string
  const reasonText = ((formData.get('reason_text') as string) ?? '').trim()

  if (!REASON_LABELS[reasonCategory]) return { error: 'Selecione um motivo.' }
  if (reasonText.length < 10) return { error: 'Descreva o motivo com um pouco mais de detalhe (pelo menos 10 caracteres) — isso fica registrado no log de auditoria.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada, faça login de novo.' }

  const db = createAdminClient()
  const { data: person } = await db.from('people').select('id').eq('id', personId).eq('organization_id', orgId).maybeSingle()
  if (!person) return { error: 'Pessoa não encontrada.' }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const { error } = await db.from('person_emergency_access').insert({
    organization_id: orgId,
    person_id: personId,
    requested_by: user.id,
    reason_category: reasonCategory,
    reason_text: reasonText,
    granted_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  })
  if (error) return { error: error.message }

  revalidatePath(`/${slug}/pessoas/${personId}`)
  revalidatePath(`/${slug}/pessoas/emergencia`)
  return { ok: true }
}

export async function revokeEmergencyAccess(formData: FormData) {
  const grantId = formData.get('grant_id') as string
  const slug = formData.get('slug') as string
  if (!grantId) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const db = createAdminClient()
  await db.from('person_emergency_access').update({ revoked_at: new Date().toISOString(), revoked_by: user.id }).eq('id', grantId)

  revalidatePath(`/${slug}/pessoas/emergencia`)
}
