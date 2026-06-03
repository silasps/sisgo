import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import type { Database } from '@/types/database'

type Props = { params: Promise<{ slug: string }> }
type Ministry = Database['public']['Tables']['ministries']['Row']

export default async function MinistriosPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  const { data } = await supabase.from('ministries').select('*').eq('organization_id', org?.id ?? '').order('name')
  const ministerios = (data ?? []) as Ministry[]

  return (
    <>
      <Header title="Ministérios" />
      <main className="p-4 md:p-6">
        {!ministerios.length ? (
          <p className="text-gray-500 text-sm">Nenhum ministério cadastrado ainda.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ministerios.map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-gray-900">{m.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {m.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {m.description && <p className="text-sm text-gray-500 mt-2">{m.description}</p>}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
