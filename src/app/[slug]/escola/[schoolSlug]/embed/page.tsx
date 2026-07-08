import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RegistrationForm } from '../RegistrationForm'
import { IframeResizer } from '@/components/ui/IframeResizer'

type Props = {
  params: Promise<{ slug: string; schoolSlug: string }>
  searchParams: Promise<{ lang?: string }>
}

export default async function SchoolEmbedPage({ params, searchParams }: Props) {
  const { slug, schoolSlug } = await params
  const { lang: langParam } = await searchParams

  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, student_communication_languages')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  if (!org) notFound()

  const communicationLanguages = (org.student_communication_languages ?? []) as string[]

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolSlug)
  const query = supabase
    .from('schools')
    .select('id, name, is_public')
    .eq('organization_id', org.id)
    .eq('is_public', true)
    .eq('active', true)

  const { data: school } = await (isUUID
    ? query.eq('id', schoolSlug).single()
    : query.eq('slug', schoolSlug).single())
  if (!school) notFound()

  const { data: classes } = await supabase
    .from('school_classes')
    .select('id, name, year, semester, online_applications')
    .eq('school_id', school.id)
    .eq('active', true)
    .order('starts_at', { ascending: true })

  return (
    <div className="min-h-screen bg-white">
      <IframeResizer>
        <div className="px-4 py-8 max-w-3xl mx-auto">
          <div className="mb-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">Pré-inscrição</p>
            <h1 className="text-2xl font-black text-gray-900">{school.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{org.name}</p>
          </div>

          <RegistrationForm
            slug={slug}
            schoolSlug={schoolSlug}
            classes={(classes ?? [])
              .filter(c => c.online_applications)
              .map(c => ({ id: c.id, name: c.name, year: c.year, semester: c.semester }))}
            communicationLanguages={communicationLanguages}
            initialLang={langParam}
          />

          <p className="text-center text-xs text-gray-300 mt-8">
            Powered by <span className="font-semibold">SISGO</span>
          </p>
        </div>
      </IframeResizer>
    </div>
  )
}
