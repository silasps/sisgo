import { createClient } from '@/lib/supabase/server'
import { SuperAdminContextBar } from '@/components/layout/SuperAdminContextBar'
import { notFound } from 'next/navigation'
import { schoolTypeShortLabel } from '@/lib/schools'
import { BookOpen } from 'lucide-react'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }

export default async function PublicBasePage({ params, searchParams }: Props) {
  const { slug } = await params
  const { preview } = await searchParams
  const supabase = await createClient()

  let isSuperAdmin = false
  if (preview === 'true') {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: orgUser } = await supabase
        .from('organization_users')
        .select('roles(name)')
        .eq('user_id', user.id)
        .eq('active', true)
        .single()
      const role = (orgUser?.roles as unknown as { name: string } | null)?.name
      isSuperAdmin = role === 'superadmin'
    }
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, city, state, email, phone, website, logo_url')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!org) notFound()

  const { data: schools } = await supabase
    .from('schools')
    .select('id, name, acronym, slug, school_type, subtitle, hero_image_url, is_public')
    .eq('organization_id', org.id)
    .eq('active', true)
    .eq('is_public', true)
    .order('name')

  return (
    <>
    {isSuperAdmin && <SuperAdminContextBar mode="public" slug={slug} baseName={org.name} />}
    <main className="min-h-screen bg-white">
      {/* Header público */}
      <header className="bg-dark-950 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <span className="font-bold text-base sm:text-lg truncate">{org.name}</span>
        <nav className="flex items-center gap-3 sm:gap-6 text-sm flex-shrink-0">
          <a href={`/${slug}#escolas`} className="hidden sm:inline hover:text-brand-400">Escolas</a>
          <a href={`/${slug}#escolas`} className="bg-brand-500 hover:bg-brand-600 px-3 sm:px-4 py-2 rounded-lg font-semibold transition-colors text-xs sm:text-sm whitespace-nowrap">
            Ver escolas
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-dark-900 text-white py-16 sm:py-24 px-5 sm:px-6 text-center">
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-3 sm:mb-4">{org.name}</h1>
        {org.city && (
          <p className="text-brand-400 text-base sm:text-lg">{org.city}{org.state ? `, ${org.state}` : ''}</p>
        )}
        <a
          href={`/${slug}#escolas`}
          className="mt-6 sm:mt-8 inline-block bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 sm:px-8 py-3 rounded-xl transition-colors"
        >
          Ver programas disponíveis
        </a>
      </section>

      {/* Grid de escolas */}
      <section id="escolas" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-dark-950 mb-2">Programas e Escolas</h2>
        <p className="text-gray-500 mb-8 sm:mb-10 text-sm sm:text-base">Encontre a escola certa para o seu chamado.</p>

        {schools && schools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-stagger">
            {schools.map((school) => (
              <a
                key={school.id}
                href={`/${slug}/escola/${school.slug ?? school.id}`}
                className="group rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-shadow bg-white"
              >
                <div className="h-48 bg-dark-800 overflow-hidden">
                  {school.hero_image_url ? (
                    <img
                      src={school.hero_image_url}
                      alt={school.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-900 to-dark-900">
                      <BookOpen className="size-10 text-white/40" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                    {schoolTypeShortLabel(school.school_type)}
                  </span>
                  <h3 className="font-bold text-dark-950 text-lg mt-1 group-hover:text-brand-600 transition-colors">
                    {school.name}
                  </h3>
                  {school.subtitle && (
                    <p className="text-gray-500 text-sm mt-1 line-clamp-2">{school.subtitle}</p>
                  )}
                  <span className="mt-4 inline-block text-sm font-semibold text-brand-500 group-hover:underline">
                    Saiba mais →
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="size-12 mx-auto mb-4 text-gray-300" />
            <p>Nenhuma escola disponível no momento.</p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-dark-950 text-white px-4 sm:px-6 py-10 sm:py-12 mt-10 sm:mt-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
          <div>
            <p className="font-bold text-lg mb-2">{org.name}</p>
            <p className="text-gray-400 text-sm">Jovens Com Uma Missão</p>
            {org.city && <p className="text-gray-400 text-sm mt-1">{org.city}{org.state ? `, ${org.state}` : ''}</p>}
          </div>
          <div>
            <p className="font-semibold mb-3 text-brand-400">Programas</p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href={`/${slug}#escolas`} className="hover:text-white transition-colors">ETEDs</a></li>
              <li><a href={`/${slug}#escolas`} className="hover:text-white transition-colors">Escolas de 2º Nível</a></li>
              <li><a href={`/${slug}/inscricao`} className="hover:text-white transition-colors">Seja Voluntário(a)</a></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-3 text-brand-400">Contato</p>
            <ul className="space-y-2 text-sm text-gray-400">
              {org.email && <li>{org.email}</li>}
              {org.phone && <li>{org.phone}</li>}
              {org.website && (
                <li>
                  <a href={org.website} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    {org.website}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-dark-800 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} {org.name} · JOCUM · Todos os direitos reservados
        </div>
      </footer>
    </main>
    </>
  )
}
