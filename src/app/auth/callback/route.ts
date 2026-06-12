import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const dest = await getPostLoginDest(supabase, user.id)
        return NextResponse.redirect(`${origin}${dest}`)
      }
      return NextResponse.redirect(`${origin}/bases`)
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
