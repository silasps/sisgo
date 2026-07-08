import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { StaffRegistrationForm } from '../StaffRegistrationForm'
import { HeartHandshake } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string; ministrySlug: string }>
  searchParams: Promise<{ lang?: string }>
}

export default async function MinistryPublicPage({ params, searchParams }: Props) {
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
    .select('id, name, slug, subtitle, description, hero_image_url')
    .eq('organization_id', org.id)
    .eq('is_public', true)
    .eq('active', true)

  const { data: ministry } = await (isUUID
    ? query.eq('id', ministrySlug).single()
    : query.eq('slug', ministrySlug).single())

  if (!ministry) notFound()

  return (
    <div className="min-h-screen bg-white">
      {/* HERO */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        {ministry.hero_image_url ? (
          <img
            src={ministry.hero_image_url}
            alt={ministry.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-amber-950 to-gray-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

        <div className="relative z-10 text-center px-5 sm:px-6 max-w-3xl mx-auto py-20">
          <span className="inline-flex items-center gap-2 mb-4 sm:mb-6 text-xs font-bold uppercase tracking-[0.2em] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 rounded-full">
            <HeartHandshake className="size-3.5" />
            Venha servir
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-3 sm:mb-4">
            {ministry.name}
          </h1>
          {ministry.subtitle && (
            <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto">{ministry.subtitle}</p>
          )}
          <div className="mt-8">
            <a
              href="#inscricao"
              className="inline-block bg-amber-500 hover:bg-amber-400 text-white font-bold px-8 py-3.5 rounded-2xl text-base sm:text-lg transition-all hover:scale-105 shadow-lg shadow-amber-500/30"
            >
              Quero servir aqui
            </a>
          </div>
        </div>
      </section>

      {/* SOBRE */}
      {ministry.description && (
        <section className="py-14 sm:py-20 px-5 sm:px-6 bg-white">
          <div className="max-w-2xl mx-auto text-center">
            <span className="text-amber-500 font-bold text-sm uppercase tracking-widest">Sobre</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-950 mt-2 mb-6">{ministry.name}</h2>
            <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-line">{ministry.description}</p>
          </div>
        </section>
      )}

      {/* FORMULÁRIO */}
      <section id="inscricao" className="py-14 sm:py-20 px-5 sm:px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <span className="text-amber-500 font-bold text-sm uppercase tracking-widest">Pré-inscrição</span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-950 mt-2">Dê o primeiro passo</h2>
            <p className="text-gray-500 mt-3 text-sm sm:text-base">
              Preencha abaixo e nossa equipe entrará em contato com mais detalhes.
            </p>
          </div>
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <StaffRegistrationForm
              slug={slug}
              ministries={[]}
              communicationLanguages={communicationLanguages}
              initialLang={langParam}
              lockedMinistryId={ministry.id}
              lockedMinistryName={ministry.name}
            />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-950 text-white px-5 py-10">
        <div className="max-w-2xl mx-auto text-center">
          <p className="font-bold">{org.name}</p>
          <p className="text-gray-500 text-sm mt-1">Jovens Com Uma Missão</p>
          <a href={`/${slug}/servir`} className="inline-block mt-4 text-sm text-amber-400 hover:text-amber-300 transition-colors">
            Ver outras oportunidades →
          </a>
        </div>
      </footer>
    </div>
  )
}
