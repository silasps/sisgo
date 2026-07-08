import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { StaffRegistrationForm } from '../../StaffRegistrationForm'
import { IframeResizer } from '@/components/ui/IframeResizer'

type Props = {
  params: Promise<{ slug: string; ministrySlug: string }>
  searchParams: Promise<{ lang?: string }>
}

export default async function MinistryEmbedPage({ params, searchParams }: Props) {
  const { slug, ministrySlug } = await params
  const { lang: langParam } = await searchParams

  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, staff_communication_languages')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  if (!org) notFound()

  const communicationLanguages = (org.staff_communication_languages ?? []) as string[]

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ministrySlug)
  const query = supabase
    .from('ministries')
    .select('id, name')
    .eq('organization_id', org.id)
    .eq('is_public', true)
    .eq('active', true)

  const { data: ministry } = await (isUUID
    ? query.eq('id', ministrySlug).single()
    : query.eq('slug', ministrySlug).single())
  if (!ministry) notFound()

  return (
    <div className="min-h-screen bg-white">
      <IframeResizer>
        <div className="px-4 py-8 max-w-2xl mx-auto">
          <div className="mb-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">Pré-inscrição</p>
            <h1 className="text-2xl font-black text-gray-900">{ministry.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{org.name}</p>
          </div>

          <StaffRegistrationForm
            slug={slug}
            ministries={[]}
            communicationLanguages={communicationLanguages}
            initialLang={langParam}
            lockedMinistryId={ministry.id}
            lockedMinistryName={ministry.name}
          />

          <p className="text-center text-xs text-gray-300 mt-8">
            Powered by <span className="font-semibold">SISGO</span>
          </p>
        </div>
      </IframeResizer>
    </div>
  )
}
