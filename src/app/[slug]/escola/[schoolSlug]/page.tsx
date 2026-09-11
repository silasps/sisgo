import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { RegistrationForm } from './RegistrationForm'
import { schoolTypeShortLabel } from '@/lib/schools'
import { getFormDict, normalizeLang, detectLangFromHeader } from '@/lib/i18n/forms'
import { resolveLocalizedText } from '@/lib/i18n/resolveLocalizedText'
import { orgShortName } from '@/lib/orgShortName'

type Props = {
  params: Promise<{ slug: string; schoolSlug: string }>
  searchParams: Promise<{ lang?: string }>
}

export default async function SchoolPublicPage({ params, searchParams }: Props) {
  const { slug, schoolSlug } = await params
  const { lang: langParam } = await searchParams
  const acceptLanguage = (await headers()).get('accept-language')
  const lang = normalizeLang(langParam ?? detectLangFromHeader(acceptLanguage))
  const d = getFormDict(lang)
  const supabase = await createClient()

  // Busca org
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, email, phone, student_communication_languages')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!org) notFound()

  const communicationLanguages = (org.student_communication_languages ?? []) as string[]

  // Busca escola por slug; se parecer UUID, também tenta por id
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolSlug)

  const query = supabase
    .from('schools')
    .select('id, name, acronym, school_type, subtitle, long_description, long_description_translations, objectives, target_audience, target_audience_translations, duration_description, hero_image_url, promo_video_url, prerequisites, is_public')
    .eq('organization_id', org.id)
    .eq('is_public', true)
    .eq('active', true)

  const { data: school } = await (isUUID
    ? query.eq('id', schoolSlug).single()
    : query.eq('slug', schoolSlug).single())

  if (!school) notFound()

  // Busca turma ativa mais próxima
  const { data: classes } = await supabase
    .from('school_classes')
    .select('id, name, year, semester, starts_at, ends_at, base_cost, cost_description, cost_description_translations, location, public_description, public_description_translations, registrations_open, registration_deadline, online_applications')
    .eq('school_id', school.id)
    .eq('active', true)
    .order('starts_at', { ascending: true })

  const activeClass = classes?.[0] ?? null

  // Busca programas extras da turma ativa
  let programs: { id: string; name: string; description: string | null; icon: string | null; image_url: string | null; additional_cost: number | null }[] = []
  if (activeClass) {
    const { data: classPrograms } = await supabase
      .from('school_class_programs')
      .select('school_programs(id, name, description, icon, image_url, additional_cost)')
      .eq('class_id', activeClass.id)

    programs = (classPrograms ?? [])
      .map(cp => cp.school_programs as unknown as typeof programs[0] | null)
      .filter((p): p is typeof programs[0] => p !== null)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return null
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  return (
    <div className="min-h-screen bg-white">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-black/60 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <a href={`/${slug}`} className="text-white font-bold text-base sm:text-lg tracking-tight hover:text-brand-400 transition-colors truncate">
            {org.name}
          </a>
          <div className="hidden md:flex items-center gap-6 lg:gap-8 text-sm text-white/70 flex-shrink-0">
            <a href="#sobre" className="hover:text-white transition-colors">{d.landingChrome.nav_about}</a>
            {programs.length > 0 && <a href="#programas" className="hover:text-white transition-colors">{d.landingChrome.nav_programs}</a>}
            {activeClass && <a href="#turma" className="hover:text-white transition-colors">{d.landingChrome.nav_next_class}</a>}
            <a href="#inscricao" className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2 rounded-full font-semibold transition-colors">
              {d.landingChrome.nav_cta}
            </a>
          </div>
          <div className="md:hidden flex items-center gap-2 flex-shrink-0">
            <a href="#sobre" className="text-white/70 hover:text-white text-xs px-2 py-1.5 transition-colors">{d.landingChrome.nav_about}</a>
            <a href="#inscricao" className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap">
              {d.landingChrome.nav_cta}
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {school.hero_image_url ? (
          <img
            src={school.hero_image_url}
            alt={school.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-brand-950 to-gray-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

        <div className="relative z-10 text-center px-5 sm:px-6 max-w-4xl mx-auto">
          <span className="inline-block mb-4 sm:mb-6 text-xs font-bold uppercase tracking-[0.2em] text-brand-400 bg-brand-500/10 border border-brand-500/30 px-4 py-1.5 rounded-full">
            {schoolTypeShortLabel(school.school_type)}
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white leading-tight mb-3 sm:mb-4">
            {school.name}
          </h1>
          {school.subtitle && (
            <p className="text-lg sm:text-xl md:text-2xl text-white/70 mb-8 sm:mb-10 max-w-2xl mx-auto">
              {school.subtitle}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <a
              href="#inscricao"
              className="bg-brand-500 hover:bg-brand-400 text-white font-bold px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-base sm:text-lg transition-all hover:scale-105 shadow-lg shadow-brand-500/30"
            >
              {d.landingChrome.hero_cta_primary}
            </a>
            <a
              href="#sobre"
              className="bg-white/10 hover:bg-white/20 text-white font-semibold px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-base sm:text-lg transition-all border border-white/20 backdrop-blur-sm"
            >
              {d.landingChrome.hero_cta_secondary}
            </a>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 animate-bounce">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* O QUE É */}
      <section id="sobre" className="py-16 sm:py-24 px-5 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 sm:gap-16 items-center">
            <div>
              <span className="text-brand-500 font-bold text-sm uppercase tracking-widest">{d.landingChrome.about_eyebrow}</span>
              <h2 className="text-4xl md:text-5xl font-black text-gray-950 mt-2 mb-6 leading-tight">
                {school.name}
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                {resolveLocalizedText(school.long_description, school.long_description_translations, lang) ?? d.landingChrome.about_fallback_description}
              </p>
              {school.target_audience && (
                <div className="mt-6 p-4 bg-brand-50 rounded-2xl border border-brand-100">
                  <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-1">{d.landingChrome.about_target_audience_label}</p>
                  <p className="text-gray-700 text-sm">{resolveLocalizedText(school.target_audience, school.target_audience_translations, lang)}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatHighlight value={school.duration_description ?? '20 semanas'} label={d.landingChrome.stat_duration_label} />
              <StatHighlight value={d.landingChrome.stat_theory_value} label={d.landingChrome.stat_theory_label} />
              <StatHighlight value={d.landingChrome.stat_field_value} label={d.landingChrome.stat_field_label} />
              <StatHighlight value={schoolTypeShortLabel(school.school_type)} label={d.landingChrome.stat_type_label} />
            </div>
          </div>
        </div>
      </section>

      {/* ESTRUTURA */}
      <section className="py-16 sm:py-24 px-5 sm:px-6 bg-gray-950 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <span className="text-brand-400 font-bold text-sm uppercase tracking-widest">{d.landingChrome.structure_eyebrow}</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-2">{d.landingChrome.structure_title}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            <PhaseCard
              number="01"
              title={d.landingChrome.phase1_title}
              weeks={d.landingChrome.phase1_weeks}
              description={d.landingChrome.phase1_description}
              color="brand"
            />
            <PhaseCard
              number="02"
              title={d.landingChrome.phase2_title}
              weeks={d.landingChrome.phase2_weeks}
              description={d.landingChrome.phase2_description}
              color="gray"
            />
          </div>
        </div>
      </section>

      {/* PROGRAMAS EXTRAS */}
      {programs.length > 0 && (
        <section id="programas" className="py-16 sm:py-24 px-5 sm:px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10 sm:mb-16">
              <span className="text-brand-500 font-bold text-sm uppercase tracking-widest">{d.landingChrome.programs_eyebrow}</span>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-950 mt-2">{d.landingChrome.programs_title}</h2>
              <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm sm:text-base">{d.landingChrome.programs_subtitle}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {programs.map(program => (
                <div key={program.id} className="group rounded-3xl border border-gray-100 hover:border-brand-200 hover:shadow-lg transition-all bg-white overflow-hidden">
                  {program.image_url ? (
                    <div className="h-44 overflow-hidden">
                      <img
                        src={program.image_url}
                        alt={program.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  ) : (
                    <div className="h-20 bg-gradient-to-br from-brand-50 to-gray-100 flex items-center justify-center text-4xl">
                      {program.icon ?? '⭐'}
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="font-bold text-gray-950 text-lg mb-2">{program.name}</h3>
                    {program.description && (
                      <p className="text-gray-500 text-sm leading-relaxed">{program.description}</p>
                    )}
                    {program.additional_cost && (
                      <p className="mt-3 text-xs font-semibold text-brand-500">
                        + {formatCurrency(program.additional_cost)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PRÉ-REQUISITOS */}
      {school.prerequisites && school.prerequisites.length > 0 && (
        <section className="py-14 sm:py-20 px-5 sm:px-6 bg-gray-50">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8 sm:mb-10">
              <span className="text-brand-500 font-bold text-sm uppercase tracking-widest">{d.landingChrome.prerequisites_eyebrow}</span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-950 mt-2">{d.landingChrome.prerequisites_title}</h2>
            </div>
            <ul className="space-y-3">
              {school.prerequisites.map((req: string, i: number) => (
                <li key={i} className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-gray-100">
                  <span className="text-brand-500 font-bold text-lg mt-0.5">✓</span>
                  <span className="text-gray-700">{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* PRÓXIMA TURMA */}
      {activeClass && (
        <section id="turma" className="py-16 sm:py-24 px-5 sm:px-6 bg-gray-950 text-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <span className="text-brand-400 font-bold text-sm uppercase tracking-widest">{d.landingChrome.next_class_eyebrow}</span>
              <h2 className="text-3xl sm:text-4xl font-black mt-2">{activeClass.name}</h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10 animate-stagger">
              {activeClass.starts_at && (
                <InfoTile label={d.landingChrome.info_starts} value={formatDate(activeClass.starts_at) ?? '—'} />
              )}
              {activeClass.ends_at && (
                <InfoTile label={d.landingChrome.info_ends} value={formatDate(activeClass.ends_at) ?? '—'} />
              )}
              {activeClass.location && (
                <InfoTile label={d.landingChrome.info_location} value={activeClass.location} />
              )}
              {activeClass.base_cost && (
                <InfoTile label={d.landingChrome.info_investment} value={formatCurrency(activeClass.base_cost) ?? '—'} />
              )}
            </div>

            {activeClass.cost_description && (
              <p className="text-gray-400 text-sm text-center mb-8">{resolveLocalizedText(activeClass.cost_description, activeClass.cost_description_translations, lang)}</p>
            )}

            {activeClass.public_description && (
              <p className="text-gray-300 text-center max-w-2xl mx-auto mb-8">{resolveLocalizedText(activeClass.public_description, activeClass.public_description_translations, lang)}</p>
            )}

            <div className="flex justify-center">
              {activeClass.registrations_open ? (
                <a href="#inscricao" className="bg-brand-500 hover:bg-brand-400 text-white font-bold px-10 py-4 rounded-2xl text-lg transition-all hover:scale-105 shadow-lg shadow-brand-500/30">
                  {d.landingChrome.registrations_open_cta}
                </a>
              ) : (
                <div className="text-center">
                  <span className="inline-block bg-white/10 text-white/60 px-6 py-3 rounded-2xl text-sm border border-white/10">
                    {d.landingChrome.registrations_soon}
                  </span>
                  <p className="text-gray-500 text-xs mt-3">{d.landingChrome.registrations_soon_hint}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* FORMULÁRIO DE PRÉ-INSCRIÇÃO */}
      <section id="inscricao" className="py-16 sm:py-24 px-5 sm:px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <span className="text-brand-500 font-bold text-sm uppercase tracking-widest">{d.landingChrome.registration_eyebrow}</span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-950 mt-2">{d.landingChrome.registration_title}</h2>
            <p className="text-gray-500 mt-3 text-sm sm:text-base">{d.landingChrome.registration_subtitle}</p>
          </div>
          <RegistrationForm
            slug={slug}
            schoolSlug={schoolSlug}
            classes={(classes ?? [])
              .filter(c => c.online_applications)
              .map(c => ({ id: c.id, name: c.name, year: c.year, semester: c.semester }))}
            communicationLanguages={communicationLanguages}
            initialLang={lang}
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-950 text-white px-5 sm:px-6 py-10 sm:py-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 text-center md:text-left">
          <div>
            <p className="font-bold text-lg">{org.name}</p>
            <p className="text-gray-500 text-sm">{orgShortName(org.name, d.landingChrome.footer_tagline)}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-gray-400">
            <a href={`/${slug}`} className="hover:text-white transition-colors">{d.landingChrome.footer_home}</a>
            <a href={`/${slug}#escolas`} className="hover:text-white transition-colors">{d.landingChrome.footer_other_schools}</a>
            {org.email && <a href={`mailto:${org.email}`} className="hover:text-white transition-colors break-all">{org.email}</a>}
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-6 sm:mt-8 pt-6 border-t border-white/5 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} {org.name} · {d.landingChrome.footer_rights}
        </div>
      </footer>

    </div>
  )
}

function StatHighlight({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-gray-50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col justify-between gap-3 sm:aspect-square">
      <p className="text-xl sm:text-2xl md:text-3xl font-black text-gray-950 leading-tight">{value}</p>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
    </div>
  )
}

function PhaseCard({ number, title, weeks, description, color }: {
  number: string; title: string; weeks: string; description: string; color: 'brand' | 'gray'
}) {
  return (
    <div className={`p-6 sm:p-8 rounded-2xl sm:rounded-3xl border ${color === 'brand' ? 'border-brand-500/30 bg-brand-500/5' : 'border-white/10 bg-white/5'}`}>
      <span className={`text-sm font-bold ${color === 'brand' ? 'text-brand-400' : 'text-gray-400'}`}>{number}</span>
      <h3 className="text-xl sm:text-2xl font-black text-white mt-2 mb-1">{title}</h3>
      <span className={`text-sm font-semibold ${color === 'brand' ? 'text-brand-400' : 'text-gray-400'}`}>{weeks}</span>
      <p className="text-gray-400 text-sm mt-3 sm:mt-4 leading-relaxed">{description}</p>
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/10 text-center">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1 sm:mb-2">{label}</p>
      <p className="font-bold text-white text-sm">{value}</p>
    </div>
  )
}
