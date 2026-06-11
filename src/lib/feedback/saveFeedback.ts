'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function saveFeedback(pagePath: string, pageLabel: string, suggestion: string) {
  if (!suggestion.trim()) return { error: 'Sugestão vazia' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sb = createAdminClient()
  const { error } = await sb.from('user_feedback').insert({
    user_id: user?.id ?? null,
    page_path: pagePath,
    page_label: pageLabel || pagePath,
    suggestion: suggestion.trim(),
  })
  if (error) return { error: error.message }
  return { ok: true }
}
