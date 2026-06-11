'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function salvarReferencia(token: string, data: Record<string, unknown>) {
  const sb = createAdminClient()

  const { data: ref } = await sb
    .from('reference_forms')
    .select('id, status, token_expires_at, school_application_id')
    .eq('token', token)
    .single()

  if (!ref) return { error: 'Formulário não encontrado.' }
  if (ref.status === 'enviado') return { error: 'Este formulário já foi preenchido.' }
  if (new Date(ref.token_expires_at) < new Date()) return { error: 'Este link expirou.' }

  await sb.from('reference_forms')
    .update({ form_data: data, status: 'enviado' })
    .eq('id', ref.id)

  return { success: true }
}
