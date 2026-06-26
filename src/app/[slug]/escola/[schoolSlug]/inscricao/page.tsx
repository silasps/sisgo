import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RegistrationForm } from '../RegistrationForm'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ slug: string; schoolSlug: string }>
  searchParams: Promise<{ lang?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, schoolSlug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolSlug)
  const query = supabase
    .from('schools')
    .select('name')
    .eq('organization_id', org?.id ?? '')
    .eq('is_public', true)
    .eq('active', true)

  const { data: school } = await (isUUID
    ? query.eq('id', schoolSlug).single()
    : query.eq('slug', schoolSlug).single())

  const title = school ? `Pré-inscrição — ${school.name}` : 'Pré-inscrição'
  const description = org && school
    ? `Preencha o formulário de pré-inscrição para ${school.name} — ${org.name}`
    : 'Formulário de pré-inscrição'

  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default async function StandaloneRegistrationPage({ params, searchParams }: Props) {
  const { slug, schoolSlug } = await params
  const { lang: langParam } = await searchParams

  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  if (!org) notFound()

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolSlug)
  const query = supabase
    .from('schools')
    .select('id, name, acronym, is_public')
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-brand-50/30 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-lg">

          {/* Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 text-brand-600 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
              Pré-inscrição
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
              {school.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1.5">{org.name}</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/60 border border-gray-100 p-6 sm:p-8">
            <RegistrationForm
              slug={slug}
              schoolSlug={schoolSlug}
              classes={(classes ?? [])
                .filter(c => c.online_applications)
                .map(c => ({ id: c.id, name: c.name, year: c.year, semester: c.semester }))}
              initialLang={langParam}
            />
          </div>

          {/* Footer */}
          <div className="mt-6 text-center space-y-2">
            <a
              href={`/${slug}/escola/${schoolSlug}`}
              className="inline-block text-sm text-brand-500 hover:text-brand-600 font-medium transition-colors"
            >
              Saiba mais sobre a escola &rarr;
            </a>
            <p className="text-xs text-gray-300">
              Powered by <span className="font-semibold">SISGO</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
