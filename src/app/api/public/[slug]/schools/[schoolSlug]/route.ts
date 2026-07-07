import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgBySlug, resolvePublicOrigin, publicJson, notFoundJson, corsPreflight } from '@/lib/public-api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; schoolSlug: string }> }
) {
  const { slug, schoolSlug } = await params
  const supabase = await createClient()

  const org = await resolveOrgBySlug(supabase, slug)
  if (!org) return notFoundJson('Base não encontrada')

  const origin = await resolvePublicOrigin(supabase, request, org.id)

  const { data: school } = await supabase
    .from('schools')
    .select('id, slug, name, acronym, school_type, subtitle, long_description, objectives, target_audience, duration_description, hero_image_url, hero_video_url, promo_video_url, prerequisites')
    .eq('organization_id', org.id)
    .eq('slug', schoolSlug)
    .eq('is_public', true)
    .eq('active', true)
    .single()

  if (!school) return notFoundJson('Escola não encontrada')

  const { data: classes } = await supabase
    .from('school_classes')
    .select('id, name, year, semester, starts_at, ends_at, base_cost, cost_description, location, public_description, registrations_open, registration_deadline, online_applications')
    .eq('school_id', school.id)
    .eq('active', true)
    .order('starts_at', { ascending: true })

  return publicJson({ ...school, upcoming_classes: classes ?? [] }, origin)
}

export async function OPTIONS() {
  return corsPreflight()
}
