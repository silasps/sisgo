import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseCookieOptions } from './cookie-options'

// Slugs reservados — nenhuma org pode usar estes valores
const RESERVED = new Set(['login', 'cadastro', 'auth', 'superadmin', 'supervisor', 'api', '_next', 'images', 'favicon.ico'])

// Sub-paths públicos dentro de /{slug}/ (sem auth)
const PUBLIC_SUBPATHS = ['escola', 'inscricao', 'candidato', 'formulario', 'referencia', 'verificar-email']

function isPublicSlugRoute(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0 || RESERVED.has(parts[0])) return false
  // /{slug} exato → público
  if (parts.length === 1) return true
  // /{slug}/escola/*, /{slug}/inscricao/*, /{slug}/candidato/*
  return PUBLIC_SUBPATHS.includes(parts[1])
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (request.nextUrl.hostname === 'www.sisgomission.com' && !pathname.startsWith('/auth/callback')) {
    const canonicalUrl = request.nextUrl.clone()
    canonicalUrl.hostname = 'sisgomission.com'
    return NextResponse.redirect(canonicalUrl, 308)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getSupabaseCookieOptions(request.nextUrl.hostname),
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

  // getUser() valida o JWT com o servidor Supabase e faz refresh automático
  // do access token quando expirado — mais confiável que getSession().
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError) {
    const msg = userError.message ?? ''
    if (msg.includes('Refresh Token') || msg.includes('Invalid Refresh Token')) {
      const authCookieNames = request.cookies
        .getAll()
        .filter(c => c.name.startsWith('sb-') && c.name.includes('auth-token'))
        .map(c => c.name)

      for (const name of authCookieNames) request.cookies.delete(name)
      supabaseResponse = NextResponse.next({ request })
      for (const name of authCookieNames) {
        supabaseResponse.cookies.set(name, '', { maxAge: 0, path: '/' })
      }
    }
  }
  // Copia cookies de sessão (ex: token refreshed) para respostas de redirect
  function redirectWithCookies(url: URL) {
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      response.cookies.set(cookie)
    })
    return response
  }

  // Landing page: se já existe sessão válida, entra direto no painel correto.
  if (pathname === '/') {
    if (user) {
      const dest = await getRedirectDest(supabase, user.id)
      return redirectWithCookies(new URL(dest, request.url))
    }
    return supabaseResponse
  }

  // Bases e rotas públicas de base — sempre públicas
  if (pathname.startsWith('/bases') || isPublicSlugRoute(pathname)) return supabaseResponse

  // Rotas públicas de auth
  if (pathname.startsWith('/login') || pathname.startsWith('/cadastro') || pathname.startsWith('/auth')) {
    if (user) {
      const dest = await getRedirectDest(supabase, user.id)
      return redirectWithCookies(new URL(dest, request.url))
    }
    return supabaseResponse
  }

  // Rotas protegidas — sem sessão → login
  if (!user) return redirectWithCookies(new URL('/login', request.url))

  // Superadmin
  if (pathname.startsWith('/superadmin')) {
    const roles = await getUserRoles(supabase, user.id)
    if (!roles.includes('superadmin')) return redirectWithCookies(new URL('/login', request.url))
  }

  if (pathname.startsWith('/supervisor')) {
    const roles = await getUserRoles(supabase, user.id)
    if (!roles.includes('supervisor_bases') && !roles.includes('superadmin')) {
      return redirectWithCookies(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUserRoles(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('organization_users').select('roles(name)')
    .eq('user_id', userId).eq('active', true)
  return (data ?? []).map((row: { roles?: { name?: string } }) => row.roles?.name).filter(Boolean)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getRedirectDest(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from('organization_users')
    .select('roles(name), organization_id')
    .eq('user_id', userId).eq('active', true)

  const rows = (data ?? []) as Array<{ organization_id: string | null; roles?: { name?: string } }>
  const roleNames = rows.map(row => row.roles?.name).filter(Boolean)
  if (roleNames.includes('superadmin')) return '/superadmin'
  if (roleNames.includes('supervisor_bases')) return '/supervisor'

  const orgId = rows.find(row => row.organization_id)?.organization_id
  if (!orgId) return '/bases'

  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .single()

  return org?.slug ? `/${org.slug}/pessoas` : '/bases'
}
