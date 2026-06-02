import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'
import type { Database } from '@/types/database'

type School = Database['public']['Tables']['schools']['Row']

export default async function EscolasPage() {
  const supabase = await createClient()
  const { data: escolas } = await supabase
    .from('schools')
    .select('*')
    .order('name')

  const rows = (escolas ?? []) as School[]

  return (
    <>
      <Header title="Escolas Missionárias" />
      <main className="p-6">
        {!rows.length ? (
          <p className="text-gray-500 text-sm">Nenhuma escola cadastrada ainda.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(escola => (
              <Link
                key={escola.id}
                href={`/admin/escolas/${escola.id}/turmas`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{escola.name}</p>
                    {escola.acronym && (
                      <p className="text-xs text-gray-500 mt-0.5">{escola.acronym}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    escola.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {escola.active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                {escola.description && (
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">{escola.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
