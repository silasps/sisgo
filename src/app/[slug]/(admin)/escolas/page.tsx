import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'
import type { Database } from '@/types/database'

type Props = { params: Promise<{ slug: string }> }
type School = Database['public']['Tables']['schools']['Row']

export default async function EscolasPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  const { data } = await supabase.from('schools').select('*').eq('organization_id', org?.id ?? '').order('name')
  const escolas = (data ?? []) as School[]

  return (
    <>
      <Header
        title="Escolas Missionárias"
        actions={
          <Link href={`/${slug}/escolas/nova`}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
            + Nova escola
          </Link>
        }
      />
      <main className="p-4 md:p-6">
        {!escolas.length ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-400 text-sm mb-3">Nenhuma escola cadastrada ainda.</p>
            <Link href={`/${slug}/escolas/nova`} className="text-brand-500 hover:text-brand-600 text-sm font-medium">
              + Criar primeira escola
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {escolas.map(e => (
              <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-200 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{e.name}</p>
                    {e.acronym && <p className="text-xs text-gray-500 mt-0.5">{e.acronym}</p>}
                  </div>
                  <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${e.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {e.active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                {e.description && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{e.description}</p>}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Link href={`/${slug}/escolas/${e.id}`}
                    className="flex-1 text-center text-xs font-medium text-brand-500 hover:text-brand-600 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">
                    Editar escola
                  </Link>
                  <Link href={`/${slug}/escolas/${e.id}/turmas`}
                    className="flex-1 text-center text-xs font-medium text-gray-500 hover:text-gray-700 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                    Ver turmas
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
