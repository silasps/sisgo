import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseCookieOptions } from './cookie-options'

// Quando o projeto estiver rodando: npx supabase gen types typescript --project-id <id> > src/types/database.ts
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getSupabaseCookieOptions(),
    }
  )
}
