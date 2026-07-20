import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseCookieOptions } from '@/lib/supabase/cookie-options'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: getSupabaseCookieOptions(request.nextUrl.hostname),
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            cookiesToSet.push(...cookies)
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const next = searchParams.get('next')
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null

      const { data: { user } } = await supabase.auth.getUser()
      const dest = safeNext ?? (user ? await getPostLoginDest(supabase, user.id) : '/bases')

      const response = NextResponse.redirect(`${origin}${dest}`)
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      }
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPostLoginDest(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from('organization_users')
    .select('roles(name), organization_id')
    .eq('user_id', userId)
    .eq('active', true)

  const rows = (data ?? []) as Array<{ organization_id: string | null; roles?: { name?: string } }>
  const roleNames = rows.map((r: { roles?: { name?: string } }) => r.roles?.name).filter(Boolean)

  if (roleNames.includes('superadmin')) return '/superadmin'
  if (roleNames.includes('supervisor_bases')) return '/supervisor'

  const orgId = rows.find(r => r.organization_id)?.organization_id
  if (!orgId) return '/bases'

  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .single()

  return org?.slug ? `/${org.slug}/pessoas` : '/bases'
}
