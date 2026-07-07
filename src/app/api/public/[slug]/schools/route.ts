import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgBySlug, resolvePublicOrigin, publicJson, notFoundJson, corsPreflight } from '@/lib/public-api'

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const org = await resolveOrgBySlug(supabase, slug)
  if (!org) return notFoundJson('Base não encontrada')

  const origin = await resolvePublicOrigin(supabase, request, org.id)

  const { data: schools } = await supabase
    .from('schools')
    .select('slug, name, acronym, school_type, subtitle, long_description, objectives, target_audience, duration_description, hero_image_url, hero_video_url, promo_video_url, prerequisites')
    .eq('organization_id', org.id)
    .eq('is_public', true)
    .eq('active', true)
    .order('name', { ascending: true })

  return publicJson(schools ?? [], origin)
}

export async function OPTIONS() {
  return corsPreflight()
}
