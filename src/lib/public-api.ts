import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

export async function resolveOrgBySlug(supabase: Supabase, slug: string) {
  const { data } = await supabase
    .from('organizations')
    .select('id, name, slug, city, state, email, phone, website, logo_url')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  return data
}

/**
 * Token público é opcional: dado já é público independente dele.
 * Quando presente, valida via validate_public_api_token() (SECURITY DEFINER,
 * não expõe a tabela de tokens) e é usado só pra CORS allow-list.
 */
export async function resolvePublicOrigin(supabase: Supabase, request: NextRequest, orgId: string) {
  const token = request.headers.get('x-sisgo-public-token')?.trim()
  const requestOrigin = request.headers.get('origin')

  if (!token) return '*'

  const { data } = await supabase.rpc('validate_public_api_token', { p_token: token })
  const validated = data as { organization_id: string; allowed_origin: string | null } | null
  if (!validated || validated.organization_id !== orgId) return '*'

  if (validated.allowed_origin && requestOrigin === validated.allowed_origin) return validated.allowed_origin
  return '*'
}

export function publicJson(data: unknown, origin: string, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      ...init?.headers,
    },
  })
}

export function notFoundJson(message: string) {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function corsPreflight(origin = '*') {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'x-sisgo-public-token',
    },
  })
}
