import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'

export default async function SuperAdminDashboard() {
  const supabase = await createClient()

  const [
    { count: totalOrgs },
    { count: activeOrgs },
    { count: totalUsers },
    { data: bases },
  ] = await Promise.all([
    supabase.from('organizations').select('*', { count: 'exact', head: true }),
    supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('organization_users').select('*', { count: 'exact', head: true }),
    supabase.from('organizations').select('id, name, slug, city, state, active, created_at').order('name'),
  ])

  return (
    <>
      <Header
        title="Visão Geral"
        actions={
          <Link href="/superadmin/bases/nova" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
            + Nova base
          </Link>
        }
      />
      <main className="p-4 md:p-6 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total de bases" value={totalOrgs ?? 0} icon="🏛" />
          <StatCard label="Bases ativas" value={activeOrgs ?? 0} icon="✅" />
          <StatCard label="Usuários" value={totalUsers ?? 0} icon="👤" />
        </div>

        {/* Mapa de bases */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-4">Todas as bases</h2>
          {!bases?.length ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
              <p className="text-gray-400 text-sm mb-3">Nenhuma base cadastrada.</p>
              <Link href="/superadmin/bases/nova" className="text-brand-500 hover:text-brand-600 text-sm font-medium">
                + Criar primeira base
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bases.map(base => (
                <div key={base.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{base.name}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">/{base.slug}</p>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      base.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${base.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {base.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  {(base.city || base.state) && (
                    <p className="text-xs text-gray-500 mb-3">
                      📍 {[base.city, base.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <Link
                      href={`/${base.slug}`}
                      className="flex-1 text-center text-xs font-medium text-brand-500 hover:text-brand-600 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                    >
                      Acessar base →
                    </Link>
                    <Link
                      href={`/superadmin/bases/${base.id}`}
                      className="flex-1 text-center text-xs font-medium text-gray-500 hover:text-gray-700 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Detalhes
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}
