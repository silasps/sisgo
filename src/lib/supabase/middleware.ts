import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          supabaseResponse = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          }
        },
      },
    }
  )

  // getSession lê o JWT do cookie sem chamada de rede — suficiente para redirect
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  const pathname = request.nextUrl.pathname

  // Rota de login: se já autenticado, redireciona para o painel correto
  if (pathname.startsWith('/login') || pathname.startsWith('/auth')) {
    if (user) {
      const role = await getUserRole(supabase, user.id)
      const dest = role === 'superadmin' ? '/superadmin' : '/admin'
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return supabaseResponse
  }

  // Rotas protegidas: sem sessão → login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Raiz → painel do papel
  if (pathname === '/') {
    const role = await getUserRole(supabase, user.id)
    return NextResponse.redirect(new URL(role === 'superadmin' ? '/superadmin' : '/admin', request.url))
  }

  // Superadmin area: bloqueia quem não é superadmin
  if (pathname.startsWith('/superadmin')) {
    const role = await getUserRole(supabase, user.id)
    if (role !== 'superadmin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  return supabaseResponse
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUserRole(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', userId)
    .eq('active', true)
    .single()

  return data?.roles?.name ?? null
}
