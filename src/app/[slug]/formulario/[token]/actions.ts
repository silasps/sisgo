'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function salvarSecao(token: string, section: number, data: Record<string, unknown>) {
  const sb = createAdminClient()

  const { data: app } = await sb
    .from('school_applications')
    .select('id, form_data, current_section')
    .eq('token', token)
    .single()

  if (!app) return { error: 'Formulário não encontrado.' }

  const existing = (app.form_data as Record<string, unknown>) ?? {}
  const updated = {
    ...existing,
    [`s${section}`]: data,
  }

  await sb.from('school_applications').update({
    form_data: updated,
    current_section: Math.max(app.current_section ?? 1, section),
  }).eq('token', token)

  return { success: true }
}

export async function enviarFormulario(token: string) {
  const sb = createAdminClient()
  await sb.from('school_applications')
    .update({ status: 'enviado' })
    .eq('token', token)
  return { success: true }
}
