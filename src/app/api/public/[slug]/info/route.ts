import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgBySlug, resolvePublicOrigin, publicJson, notFoundJson, corsPreflight } from '@/lib/public-api'

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const org = await resolveOrgBySlug(supabase, slug)
  if (!org) return notFoundJson('Base não encontrada')

  const origin = await resolvePublicOrigin(supabase, request, org.id)

  return publicJson(
    {
      name: org.name,
      slug: org.slug,
      city: org.city,
      state: org.state,
      email: org.email,
      phone: org.phone,
      website: org.website,
      logo_url: org.logo_url,
    },
    origin
  )
}

export async function OPTIONS() {
  return corsPreflight()
}
