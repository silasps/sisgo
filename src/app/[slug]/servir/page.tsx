import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { StaffRegistrationForm } from './StaffRegistrationForm'
import { HeartHandshake } from 'lucide-react'
import { getStaffFormDict, normalizeStaffLang } from '@/lib/i18n/staff-forms'
import { detectLangFromHeader } from '@/lib/i18n/forms'
import { resolveLocalizedText } from '@/lib/i18n/resolveLocalizedText'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lang?: string }>
}

export default async function ServirPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { lang: langParam } = await searchParams
  const acceptLanguage = (await headers()).get('accept-language')
  const lang = normalizeStaffLang(langParam ?? detectLangFromHeader(acceptLanguage))
  const d = getStaffFormDict(lang)

  const sb = createAdminClient()

  const { data: org } = await sb
    .from('organizations')
    .select('id, name, logo_url, staff_communication_languages')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!org) notFound()

  const communicationLanguages = (org.staff_communication_languages ?? []) as string[]

  const { data: ministriesRaw } = await sb
    .from('ministries')
    .select('id, name')
    .eq('organization_id', org.id)
    .eq('active', true)
    .order('name')

  const ministries = (ministriesRaw ?? []) as { id: string; name: string }[]

  const { data: schoolsRaw } = await sb
    .from('schools')
    .select('id, name')
    .eq('organization_id', org.id)
    .eq('active', true)
    .order('name')

  const schools = (schoolsRaw ?? []) as { id: string; name: string }[]

  const { data: publicMinistriesRaw } = await sb
    .from('ministries')
    .select('id, name, slug, subtitle, subtitle_translations, description, description_translations, hero_image_url')
    .eq('organization_id', org.id)
    .eq('active', true)
    .eq('is_public', true)
    .order('name')

  const publicMinistries = ((publicMinistriesRaw ?? []) as {
    id: string; name: string; slug: string | null; subtitle: string | null
    subtitle_translations: Partial<Record<'en' | 'es', string>> | null
    description: string | null; description_translations: Partial<Record<'en' | 'es', string>> | null
    hero_image_url: string | null
  }[]).filter(m => m.slug)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
          <a href={`/${slug}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <HeartHandshake className="size-7 text-amber-600" />
            )}
            <span className="font-bold text-gray-900 text-sm">{org.name}</span>
          </a>
        </div>
      </header>

      <main className="flex-1">
      {/* Hero */}
      <section className="px-5 pt-12 pb-8 sm:pt-16 sm:pb-10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            <HeartHandshake className="size-4" />
            {d.servirChrome.hero_badge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-950 leading-tight">
            {d.servirChrome.hero_title}
          </h1>
          <p className="text-gray-500 mt-4 text-sm sm:text-base max-w-lg mx-auto">
            {d.servirChrome.hero_subtitle}
          </p>
        </div>
      </section>

      {/* Grid de oportunidades por ministério */}
      {publicMinistries.length > 0 && (
        <section className="px-5 pb-12 sm:pb-16">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-black text-gray-950 text-center mb-8">
              {d.servirChrome.opportunities_title}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {publicMinistries.map(ministry => (
                <a
                  key={ministry.id}
                  href={`/${slug}/servir/${ministry.slug}`}
                  className="group rounded-2xl border border-gray-100 bg-white overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  {ministry.hero_image_url ? (
                    <div className="h-32 overflow-hidden">
                      <img
                        src={ministry.hero_image_url}
                        alt={ministry.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  ) : (
                    <div className="h-16 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
                      <HeartHandshake className="size-6 text-amber-500" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-950">{ministry.name}</h3>
                    {(ministry.subtitle || ministry.description) && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {resolveLocalizedText(ministry.subtitle, ministry.subtitle_translations, lang) ?? resolveLocalizedText(ministry.description, ministry.description_translations, lang)}
                      </p>
                    )}
                    <span className="inline-block mt-3 text-xs font-semibold text-amber-600 group-hover:text-amber-700">
                      {d.servirChrome.learn_more}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Formulário */}
      <section className="px-5 pb-16 sm:pb-24">
        <div className="max-w-2xl mx-auto">
          {publicMinistries.length > 0 && (
            <p className="text-center text-sm text-gray-500 mb-6">
              {d.servirChrome.no_ministry_hint}
            </p>
          )}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <StaffRegistrationForm
              slug={slug}
              ministries={ministries}
              schools={schools}
              communicationLanguages={communicationLanguages}
              initialLang={lang}
            />
          </div>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-950 text-white px-5 py-10">
        <div className="max-w-2xl mx-auto text-center">
          <p className="font-bold">{org.name}</p>
          <p className="text-gray-500 text-sm mt-1">{d.servirChrome.footer_tagline}</p>
          <p className="text-xs text-gray-600 mt-4">
            © {new Date().getFullYear()} {org.name} · JOCUM · {d.servirChrome.footer_rights}
          </p>
        </div>
      </footer>
    </div>
  )
}
