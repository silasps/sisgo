import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'

type Props = { params: Promise<{ slug: string }> }
type Row = { id: string; active: boolean; created_at: string; people: { full_name: string } | null }

export default async function AlunosPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  const { data } = await supabase
    .from('student_profiles')
    .select('id, active, created_at, people(full_name)')
    .eq('organization_id', org?.id ?? '')
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as unknown as Row[]

  return (
    <>
      <Header title="Alunos" />
      <main className="p-4 md:p-6">
        {!rows.length ? (
          <p className="text-gray-500 text-sm">Nenhum aluno cadastrado ainda.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Desde</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.people?.full_name ?? '—'}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-500">
                      {new Date(s.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.active ? 'Ativo' : 'Inativo'}
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
