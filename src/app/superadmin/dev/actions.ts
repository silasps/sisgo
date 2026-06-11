'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

type Status = 'novo' | 'em_andamento' | 'feito' | 'descartado'

export async function updateFeedbackStatus(id: string, status: Status) {
  const sb = createAdminClient()
  const { error } = await sb.from('user_feedback').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/superadmin/dev')
  return { ok: true }
}

export async function deleteFeedback(id: string) {
  const sb = createAdminClient()
  const { error } = await sb.from('user_feedback').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/superadmin/dev')
  return { ok: true }
}
