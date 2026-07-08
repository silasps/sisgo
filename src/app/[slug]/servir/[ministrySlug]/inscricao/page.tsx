import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { StaffRegistrationForm } from '../../StaffRegistrationForm'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ slug: string; ministrySlug: string }>
  searchParams: Promise<{ lang?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, ministrySlug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ministrySlug)
  const query = supabase
    .from('ministries')
    .select('name')
    .eq('organization_id', org?.id ?? '')
    .eq('is_public', true)
    .eq('active', true)

  const { data: ministry } = await (isUUID
    ? query.eq('id', ministrySlug).single()
    : query.eq('slug', ministrySlug).single())

  const title = ministry ? `Pré-inscrição — ${ministry.name}` : 'Pré-inscrição'
  const description = org && ministry
    ? `Preencha o formulário de pré-inscrição para servir em ${ministry.name} — ${org.name}`
    : 'Formulário de pré-inscrição'

  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default async function StandaloneMinistryRegistrationPage({ params, searchParams }: Props) {
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-lg">

          {/* Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
              Pré-inscrição
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
              {ministry.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1.5">{org.name}</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/60 border border-gray-100 p-6 sm:p-8">
            <StaffRegistrationForm
              slug={slug}
              ministries={[]}
              communicationLanguages={communicationLanguages}
              initialLang={langParam}
              lockedMinistryId={ministry.id}
              lockedMinistryName={ministry.name}
            />
          </div>

          {/* Footer */}
          <div className="mt-6 text-center space-y-2">
            <a
              href={`/${slug}/servir/${ministrySlug}`}
              className="inline-block text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors"
            >
              Saiba mais sobre o ministério &rarr;
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
