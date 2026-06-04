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
      <Header title="Escolas Missionárias" />
      <main className="p-4 md:p-6">
        {!escolas.length ? (
          <p className="text-gray-500 text-sm">Nenhuma escola cadastrada ainda.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {escolas.map(e => (
              <Link
                key={e.id}
                href={`/${slug}/escolas/${e.id}/turmas`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{e.name}</p>
                    {e.acronym && <p className="text-xs text-gray-500 mt-0.5">{e.acronym}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {e.active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                {e.description && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{e.description}</p>}
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
