import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'

type Row = {
  id: string; role_title: string | null; area: string | null; active: boolean
  people: { full_name: string } | null
}

export default async function ObreirosPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('staff_profiles')
    .select('id, role_title, area, active, people(full_name)')
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as unknown as Row[]

  return (
    <>
      <Header title="Obreiros" />
      <main className="p-6">
        {!rows.length ? (
          <p className="text-gray-500 text-sm">Nenhum obreiro cadastrado ainda.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Nome</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Função</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Área</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.people?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.role_title ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.area ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
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
