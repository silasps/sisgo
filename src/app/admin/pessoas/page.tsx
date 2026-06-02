import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'

export default async function PessoasPage() {
  const supabase = await createClient()
  const { data: pessoas } = await supabase
    .from('people')
    .select('id, full_name, preferred_name, birth_date, gender, created_at')
    .order('full_name')

  return (
    <>
      <Header
        title="Pessoas"
        actions={
          <button className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600">
            Nova pessoa
          </button>
        }
      />
      <main className="p-6">
        {!pessoas?.length ? (
          <p className="text-gray-500 text-sm">Nenhuma pessoa cadastrada ainda.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Nome</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Nome preferido</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Nascimento</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Gênero</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pessoas.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.full_name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.preferred_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.birth_date ? new Date(p.birth_date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.gender ?? '—'}</td>
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
