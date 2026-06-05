import { createClient } from '@supabase/supabase-js'

// Cliente com service role — usa apenas em server actions, nunca no browser
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
