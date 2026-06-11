import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Database } from '@/types/database'

type Props = { params: Promise<{ slug: string; id: string }> }
type ClassRow = Database['public']['Tables']['school_classes']['Row']

export default async function TurmasPage({ params }: Props) {
  const { slug, id } = await params
  const supabase = await createClient()

  const { data: escola } = await supabase.from('schools').select('name').eq('id', id).single()
  if (!escola) notFound()

  const { data } = await supabase.from('school_classes').select('*').eq('school_id', id).order('name')
  const turmas = (data ?? []) as ClassRow[]

  return (
    <>
      <Header title={`Turmas — ${escola.name}`} />
      <main className="p-4 md:p-6">
        {!turmas.length ? (
          <p className="text-gray-500 text-sm">Nenhuma turma cadastrada.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Turma</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Período</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {turmas.map(t => (
                  <tr key={t.id} className="group relative hover:bg-brand-50 transition-colors cursor-pointer">
                    <td className="p-0">
                      <Link href={`/${slug}/escolas/${id}/turmas/${t.id}`} className="absolute inset-0" aria-label={`Abrir turma ${t.name}`} />
                      <span className="block px-4 py-3 font-medium text-gray-900 group-hover:text-brand-700 transition-colors">{t.name}</span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-500">
                      {[t.year, t.semester].filter(Boolean).join('/') || '—'}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${t.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {t.active ? 'Ativa' : 'Encerrada'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        Abrir →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
