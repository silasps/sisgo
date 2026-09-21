import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PesquisaHospitalidadeForm } from './PesquisaHospitalidadeForm'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ slug: string; schoolSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, schoolSlug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  const school = org ? await findSchool(supabase, org.id, schoolSlug) : null

  const title = school ? `Pesquisa de Satisfação — ${school.name}` : 'Pesquisa de Satisfação'
  const description = org && school
    ? `Conte pra gente como foi sua experiência em ${school.name} — ${org.name}`
    : 'Pesquisa de satisfação'

  return { title, description, openGraph: { title, description } }
}

async function findSchool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  schoolSlug: string,
) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolSlug)
  const query = supabase.from('schools').select('id, name').eq('organization_id', organizationId)
  const { data } = await (isUUID ? query.eq('id', schoolSlug).single() : query.eq('slug', schoolSlug).single())
  return data
}

export default async function PesquisaHospitalidadePage({ params }: Props) {
  const { slug, schoolSlug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!org) notFound()

  const school = await findSchool(supabase, org.id, schoolSlug)
  if (!school) notFound()

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
            Jovens Com Uma Missão
          </p>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">
            Pesquisa de Satisfação — {school.name}
          </h1>
          <p className="text-sm text-gray-400">{org.name}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
          <PesquisaHospitalidadeForm slug={slug} schoolSlug={schoolSlug} />
        </div>
      </main>
    </div>
  )
}
