import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'

export default async function BasesPage() {
  const supabase = await createClient()

  const { data: bases } = await supabase
    .from('organizations')
    .select('id, name, slug, city, state, active, created_at, email, phone')
    .order('name')

  return (
    <>
      <Header
        title="Bases"
        actions={
          <Link
            href="/superadmin/bases/nova"
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + Nova base
          </Link>
        }
      />
      <main className="p-4 md:p-6">
        {!bases?.length ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-2xl mb-2">🏛</p>
            <p className="text-gray-500 text-sm mb-4">Nenhuma base cadastrada ainda.</p>
            <Link
              href="/superadmin/bases/nova"
              className="inline-flex px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600"
            >
              + Criar primeira base
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="md:hidden space-y-3">
              {bases.map((base) => (
                <Link
                  key={base.id}
                  href={`/superadmin/bases/${base.id}`}
                  className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{base.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{base.slug}</p>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      base.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${base.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {base.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    {(base.city || base.state) && (
                      <span>{[base.city, base.state].filter(Boolean).join(' · ')}</span>
                    )}
                    {(base.email || base.phone) && (
                      <span className="truncate">{base.email ?? base.phone}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm text-gray-500">
                  {bases.length} {bases.length === 1 ? 'base' : 'bases'}
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cidade / Estado</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Contato</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Criada em</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bases.map((base) => (
                    <tr key={base.id} className="hover:bg-gray-50 group">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{base.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{base.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {[base.city, base.state].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{base.email ?? base.phone ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          base.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${base.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {base.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(base.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/superadmin/bases/${base.id}`}
                          className="text-brand-500 hover:text-brand-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  )
}
