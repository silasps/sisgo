import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Landmark } from 'lucide-react'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'

type Props = { searchParams: Promise<{ code?: string }> }

export default async function BasesPage({ searchParams }: Props) {
  const { code } = await searchParams
  if (code) redirect(`/auth/callback?code=${code}`)
  const supabase = await createClient()
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, slug, city, state, logo_url, email')
    .eq('active', true)
    .order('name')

  return (
    <div className="min-h-screen bg-dark-950 text-white flex flex-col">
      <MarketingHeader />

      {/* Header */}
      <section className="px-5 sm:px-10 py-12 sm:py-16 max-w-6xl mx-auto w-full">
        <div className="bg-brand-500/10 border border-brand-500/20 rounded-2xl px-5 py-4 mb-8 text-sm text-brand-300">
          Bem-vindo ao SISGO! Explore as organizações abaixo e faça sua pré-inscrição para aluno, obreiro ou voluntário.
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">Organizações missionárias</h1>
        <p className="text-gray-400">
          Escolha uma organização para ver as escolas disponíveis e opções de inscrição.
        </p>
      </section>

      {/* Grid de bases */}
      <section className="px-5 sm:px-10 pb-16 max-w-6xl mx-auto w-full flex-1">
        {orgs && orgs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-stagger">
            {orgs.map(org => (
              <a
                key={org.id}
                href={`/${org.slug}`}
                className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:shadow-md hover:-translate-y-1 hover:border-brand-500/40 transition-all duration-200"
              >
                <div className="flex items-center gap-4 mb-4">
                  {org.logo_url ? (
                    <img
                      src={org.logo_url}
                      alt={org.name}
                      className="w-12 h-12 rounded-xl object-cover bg-white/10 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-lg flex-shrink-0">
                      {org.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="font-bold text-white group-hover:text-brand-400 transition-colors truncate">
                      {org.name}
                    </h2>
                    {(org.city || org.state) && (
                      <p className="text-xs text-gray-500 mt-0.5">{[org.city, org.state].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-semibold text-brand-400 group-hover:underline">
                  Ver escolas e inscrições →
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <Landmark className="size-12 mx-auto mb-4 text-gray-300" />
            <p className="font-medium">Nenhuma base disponível no momento.</p>
          </div>
        )}

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm">
          <p className="text-gray-400">
            Quer ver todas as escolas com inscrições abertas de uma vez?{' '}
            <Link href="/oportunidades" className="text-brand-400 hover:underline font-medium">
              Veja as oportunidades →
            </Link>
          </p>
          <p className="text-gray-400">
            Não encontrou sua organização?{' '}
            <Link href="/cadastro" className="text-brand-400 hover:underline font-medium">
              Crie a sua →
            </Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 px-5 sm:px-10 text-center text-xs text-gray-600">
        <Link href="/" className="hover:text-gray-400 transition-colors">
          ← Voltar ao início
        </Link>
        <span className="mx-3">·</span>
        SISGO · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
