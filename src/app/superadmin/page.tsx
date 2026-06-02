import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'

export default async function SuperAdminDashboard() {
  const supabase = await createClient()

  const [
    { count: totalOrgs },
    { count: activeOrgs },
    { count: totalUsers },
    { data: recentBases },
  ] = await Promise.all([
    supabase.from('organizations').select('*', { count: 'exact', head: true }),
    supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('organization_users').select('*', { count: 'exact', head: true }),
    supabase.from('organizations').select('id, name, slug, city, state, active, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  return (
    <>
      <Header title="Visão Geral" />
      <main className="p-6 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Bases cadastradas" value={totalOrgs ?? 0} icon="🏛" />
          <StatCard label="Bases ativas" value={activeOrgs ?? 0} icon="✅" color="green" />
          <StatCard label="Usuários" value={totalUsers ?? 0} icon="👤" />
        </div>

        {/* Bases recentes */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Bases recentes</h2>
            <Link href="/superadmin/bases" className="text-sm text-brand-500 hover:text-brand-600 font-medium">
              Ver todas →
            </Link>
          </div>

          {!recentBases?.length ? (
            <EmptyBases />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cidade / Estado</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Criada em</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentBases.map((base) => (
                    <tr key={base.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{base.name}</p>
                        <p className="text-xs text-gray-400">{base.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {[base.city, base.state].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={base.active} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(base.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/superadmin/bases/${base.id}`} className="text-brand-500 hover:text-brand-600 font-medium text-xs">
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  )
}

function StatCard({ label, value, icon, color = 'default' }: {
  label: string; value: number; icon: string; color?: 'default' | 'green'
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
        color === 'green' ? 'bg-green-50' : 'bg-brand-50'
      }`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
      {active ? 'Ativa' : 'Inativa'}
    </span>
  )
}

function EmptyBases() {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
      <p className="text-2xl mb-2">🏛</p>
      <p className="text-gray-500 text-sm mb-4">Nenhuma base cadastrada ainda.</p>
      <Link
        href="/superadmin/bases/nova"
        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
      >
        + Criar primeira base
      </Link>
    </div>
  )
}
