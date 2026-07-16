import type { SupabaseClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

export type ReferenceType = 'pastor' | 'amigo' | 'lideranca_experiencia'

export async function getOrCreateReferenceForm(
  sb: SupabaseClient,
  staffApplicationId: string,
  type: ReferenceType
): Promise<
  | { token: string; expiresAt: string; error?: undefined }
  | { error: string; token?: undefined; expiresAt?: undefined }
> {
  const { data: existing } = await sb
    .from('reference_forms')
    .select('id, token, token_expires_at, status')
    .eq('staff_application_id', staffApplicationId)
    .eq('type', type)
    .maybeSingle()

  if (existing?.status === 'pendente') {
    return { token: existing.token, expiresAt: existing.token_expires_at }
  }

  if (existing) {
    // Já foi respondida — "gerar novo link" reabre a MESMA referência (não
    // cria uma segunda linha) e limpa a resposta anterior, já que o novo
    // envio vai substituí-la.
    const { randomBytes } = await import('node:crypto')
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: updated } = await sb
      .from('reference_forms')
      .update({ token, token_expires_at: expiresAt, status: 'pendente', form_data: null })
      .eq('id', existing.id)
      .select('token, token_expires_at')
      .single()
    if (!updated) return { error: 'Não foi possível gerar o link.' }
    return { token: updated.token, expiresAt: updated.token_expires_at }
  }

  const { data: created } = await sb
    .from('reference_forms')
    .insert({ staff_application_id: staffApplicationId, type })
    .select('token, token_expires_at')
    .single()

  if (!created) return { error: 'Não foi possível gerar o link.' }
  return { token: created.token, expiresAt: created.token_expires_at }
}

export async function buildReferenceUrl(slug: string, token: string): Promise<string> {
  const hdrs = await headers()
  const host = hdrs.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  return `${protocol}://${host}/${slug}/referencia/${token}`
}
