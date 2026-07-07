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
    .select('id, name, acronym, slug, school_type, hero_image_url')
    .eq('organization_id', org.id)
    .eq('is_public', true)
    .eq('active', true)

  const schoolById = new Map((schools ?? []).map(s => [s.id, s]))
  const schoolIds = [...schoolById.keys()]

  if (schoolIds.length === 0) return publicJson([], origin)

  const { data: classes } = await supabase
    .from('school_classes')
    .select('id, name, starts_at, ends_at, location, school_id')
    .in('school_id', schoolIds)
    .eq('active', true)
    .order('starts_at', { ascending: true })

  const events = (classes ?? []).map(c => {
    const school = schoolById.get(c.school_id)
    return {
      id: c.id,
      class_name: c.name,
      starts_at: c.starts_at,
      ends_at: c.ends_at,
      location: c.location,
      school_name: school?.name ?? null,
      school_acronym: school?.acronym ?? null,
      school_slug: school?.slug ?? null,
      school_type: school?.school_type ?? null,
      hero_image_url: school?.hero_image_url ?? null,
    }
  })

  return publicJson(events, origin)
}

export async function OPTIONS() {
  return corsPreflight()
}
