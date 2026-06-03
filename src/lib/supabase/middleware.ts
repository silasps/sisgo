import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Caminhos que não são slugs de bases
const RESERVED = new Set(['login', 'cadastro', 'auth', 'superadmin', 'api', '_next', 'images', 'favicon.ico'])

function isSlugRoute(pathname: string) {
  const first = pathname.split('/')[1]
  return !!first && !RESERVED.has(first)
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          supabaseResponse = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          }
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const pathname = request.nextUrl.pathname

  // Landing page — sempre pública
  if (pathname === '/') return supabaseResponse

  // Rotas públicas de auth
  if (pathname.startsWith('/login') || pathname.startsWith('/cadastro') || pathname.startsWith('/auth')) {
    if (user) {
      const dest = await getRedirectDest(supabase, user.id)
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return supabaseResponse
  }

  // Rotas protegidas — sem sessão → login
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  // Superadmin
  if (pathname.startsWith('/superadmin')) {
    const role = await getUserRole(supabase, user.id)
    if (role !== 'superadmin') return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUserRole(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('organization_users').select('roles(name)')
    .eq('user_id', userId).eq('active', true).single()
  return data?.roles?.name ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getRedirectDest(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from('organization_users')
    .select('roles(name), organizations(slug)')
    .eq('user_id', userId).eq('active', true).single()

  const role = data?.roles?.name
  const slug = data?.organizations?.slug
  if (role === 'superadmin') return '/superadmin'
  if (slug) return `/${slug}`
  return '/login'
}
