import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgBySlug, resolvePublicOrigin, publicJson, notFoundJson, corsPreflight } from '@/lib/public-api'

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const org = await resolveOrgBySlug(supabase, slug)
  if (!org) return notFoundJson('Base não encontrada')

  const origin = await resolvePublicOrigin(supabase, request, org.id)

  const { data: stats } = await supabase.rpc('get_public_stats', { p_org_id: org.id })

  return publicJson(stats ?? {}, origin)
}

export async function OPTIONS() {
  return corsPreflight()
}
