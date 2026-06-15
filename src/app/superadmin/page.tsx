import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'
import { getEmailQuota, EMAIL_LIMITS } from '@/lib/email/getEmailQuota'

export default async function SuperAdminDashboard() {
  const supabase = await createClient()

  const sb = createAdminClient()

  const [
    { count: totalOrgs },
    { count: activeOrgs },
    { count: totalUsers },
    { data: bases },
    quota,
    { count: pendingPre },
    { count: pendingStaff },
  ] = await Promise.all([
    supabase.from('organizations').select('*', { count: 'exact', head: true }),
    supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('organization_users').select('*', { count: 'exact', head: true }),
    supabase.from('organizations').select('id, name, slug, city, state, active, created_at').order('name'),
    getEmailQuota(),
    sb.from('school_interest_forms').select('*', { count: 'exact', head: true }).in('status', ['pendente', 'formulario_enviado', 'em_contato', 'em_analise']),
    sb.from('staff_applications').select('*', { count: 'exact', head: true }).in('status', ['pendente', 'em_analise']),
  ])

  return (
    <>
      <Header
        title="Visão Geral"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/superadmin/supervisao" className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg border border-gray-200 transition-colors">
              Grupos de bases
            </Link>
            <Link href="/superadmin/bases/nova" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
              + Nova base
            </Link>
          </div>
        }
      />
      <main className="p-4 md:p-6 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <StatCard label="Total de bases" value={totalOrgs ?? 0} icon="🏛" />
          <StatCard label="Bases ativas" value={activeOrgs ?? 0} icon="✅" />
          <StatCard label="Usuários" value={totalUsers ?? 0} icon="👤" />
        </div>

        {/* Inscrições soltas */}
        {((pendingPre ?? 0) > 0 || (pendingStaff ?? 0) > 0) && (
          <section>
            <h2 className="font-semibold text-gray-900 mb-3">Inscrições pendentes</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {(pendingPre ?? 0) > 0 && (
                <Link href="/superadmin/inscricoes?tab=pre" className="group flex items-center gap-4 bg-white rounded-xl border border-yellow-200 hover:border-yellow-400 p-4 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center text-xl flex-shrink-0">📋</div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold text-gray-900">{pendingPre ?? 0}</p>
                    <p className="text-xs text-gray-500">Pré-inscrições pendentes</p>
                  </div>
                  <span className="ml-auto text-brand-500 text-sm font-semibold group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
              )}
              {(pendingStaff ?? 0) > 0 && (
                <Link href="/superadmin/inscricoes?tab=obreiros" className="group flex items-center gap-4 bg-white rounded-xl border border-blue-200 hover:border-blue-400 p-4 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">👷</div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold text-gray-900">{pendingStaff ?? 0}</p>
                    <p className="text-xs text-gray-500">Candidatos a obreiro</p>
                  </div>
                  <span className="ml-auto text-brand-500 text-sm font-semibold group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* E-mails */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">E-mails (Brevo free tier)</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <EmailQuotaCard
              label="Hoje"
              used={quota.today}
              limit={EMAIL_LIMITS.daily}
              exceeded={quota.dailyExceeded}
            />
            <EmailQuotaCard
              label="Este mês"
              used={quota.month}
              limit={EMAIL_LIMITS.monthly}
              exceeded={quota.monthlyExceeded}
            />
          </div>
          {quota.exceeded && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              ⚠ Limite atingido — o envio automático está pausado para todas as bases. O limite reinicia diariamente às 00h / mensalmente no dia 1.
            </p>
          )}
        </section>

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
                <div key={base.id} className="group relative rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-brand-300">
                  <Link
                    href={`/superadmin/bases/${base.id}`}
                    className="absolute inset-0 z-0 rounded-xl"
                    aria-label={`Ver detalhes de ${base.name}`}
                  />
                  <div className="relative z-10 mb-3 flex items-start justify-between gap-2">
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
                    <p className="relative z-10 mb-3 text-xs text-gray-500">
                      📍 {[base.city, base.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="relative z-10 flex gap-2 border-t border-gray-100 pt-2">
                    <Link
                      href={`/${base.slug}/dashboard`}
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
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3 text-center sm:text-left">
      <span className="text-xl sm:text-xl">{icon}</span>
      <div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-500 leading-tight">{label}</p>
      </div>
    </div>
  )
}

function EmailQuotaCard({ label, used, limit, exceeded }: {
  label: string
  used: number
  limit: number
  exceeded: boolean
}) {
  const pct = Math.min((used / limit) * 100, 100)
  const barColor = exceeded
    ? 'bg-red-500'
    : pct >= 90 ? 'bg-orange-400'
    : pct >= 70 ? 'bg-yellow-400'
    : 'bg-green-500'

  return (
    <div className={`bg-white rounded-xl border p-4 ${exceeded ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700">✉ {label}</p>
        <p className={`text-sm font-bold tabular-nums ${exceeded ? 'text-red-600' : 'text-gray-900'}`}>
          {used.toLocaleString('pt-BR')} / {limit.toLocaleString('pt-BR')}
        </p>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1.5">
        {exceeded ? 'Limite atingido' : `${(limit - used).toLocaleString('pt-BR')} restantes`}
      </p>
    </div>
  )
}
