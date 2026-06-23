import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { StaffRegistrationForm } from './StaffRegistrationForm'
import { HeartHandshake } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lang?: string }>
}

export default async function ServirPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { lang: langParam } = await searchParams

  const sb = createAdminClient()

  const { data: org } = await sb
    .from('organizations')
    .select('id, name, logo_url')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!org) notFound()

  const { data: ministriesRaw } = await sb
    .from('ministries')
    .select('id, name')
    .eq('organization_id', org.id)
    .eq('active', true)
    .order('name')

  const ministries = (ministriesRaw ?? []) as { id: string; name: string }[]

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <HeartHandshake className="size-7 text-amber-600" />
          )}
          <span className="font-bold text-gray-900 text-sm">{org.name}</span>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 pt-12 pb-8 sm:pt-16 sm:pb-10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            <HeartHandshake className="size-4" />
            Venha servir
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-950 leading-tight">
            Faça parte da nossa equipe
          </h1>
          <p className="text-gray-500 mt-4 text-sm sm:text-base max-w-lg mx-auto">
            Preencha o formulário abaixo para demonstrar seu interesse em servir na base. Nossa equipe entrará em contato.
          </p>
        </div>
      </section>

      {/* Formulário */}
      <section className="px-5 pb-16 sm:pb-24">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <StaffRegistrationForm
              slug={slug}
              ministries={ministries}
              initialLang={langParam}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-white px-5 py-10">
        <div className="max-w-2xl mx-auto text-center">
          <p className="font-bold">{org.name}</p>
          <p className="text-gray-500 text-sm mt-1">Jovens Com Uma Missão</p>
          <p className="text-xs text-gray-600 mt-4">
            © {new Date().getFullYear()} {org.name} · JOCUM · Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  )
}
