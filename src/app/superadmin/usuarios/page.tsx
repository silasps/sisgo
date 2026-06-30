import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'
import { Users, AlertTriangle } from 'lucide-react'

type OrgUserRow = {
  id: string
  user_id: string
  active: boolean
  created_at: string
  organization_id: string | null
  organizations: { id: string; name: string; slug: string } | null
  roles: { name: string; label: string } | null
}

export default async function SuperAdminUsuariosPage() {
  const admin = createAdminClient()

  const [
    { data: { users: authUsers } },
    { data: orgUsersRaw },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('organization_users')
      .select('id, user_id, active, created_at, organization_id, organizations(id, name, slug), roles(name, label)')
      .order('created_at', { ascending: false }),
  ])

  const orgUsers = (orgUsersRaw ?? []) as unknown as OrgUserRow[]

  // Agrupar org_users por user_id para exibir todas as bases
  const byUser = new Map<string, OrgUserRow[]>()
  for (const ou of orgUsers) {
    const list = byUser.get(ou.user_id) ?? []
    list.push(ou)
    byUser.set(ou.user_id, list)
  }

  // Mapa de metadados dos usuários auth
  const authMap = new Map(authUsers.map(u => [u.id, u]))

  // Identificar usuários sem base (orfãos)
  const assignedIds = new Set(orgUsers.filter(ou => ou.organization_id !== null).map(ou => ou.user_id))

  const rows = authUsers
    .filter(u => !u.is_anonymous)
    .map(u => {
      const links = byUser.get(u.id) ?? []
      const isOrphan = !assignedIds.has(u.id)
      return {
        id: u.id,
        email: u.email ?? '—',
        name: (u.user_metadata?.full_name as string | undefined) ?? '',
        createdAt: u.created_at,
        links,
        isOrphan,
      }
    })
    .sort((a, b) => {
      // Orfãos primeiro
      if (a.isOrphan !== b.isOrphan) return a.isOrphan ? -1 : 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const orphanCount = rows.filter(r => r.isOrphan).length

  return (
    <>
      <Header
        title="Usuários"
        actions={
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users className="size-4" />
            <span>{rows.length} usuários no sistema</span>
          </div>
        }
      />
      <main className="p-4 md:p-6 space-y-6">

        {orphanCount > 0 && (
          <Link
            href="/superadmin/inscricoes"
            className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-3 hover:border-yellow-400 transition-colors group"
          >
            <AlertTriangle className="size-4 text-yellow-600 flex-shrink-0" />
            <span className="text-sm text-yellow-800">
              <strong>{orphanCount}</strong> {orphanCount === 1 ? 'usuário sem base' : 'usuários sem base'} — sem acesso ao sistema.
            </span>
            <span className="ml-auto text-xs font-semibold text-yellow-700 group-hover:translate-x-0.5 transition-transform">
              Ver inscrições →
            </span>
          </Link>
        )}

        {/* Desktop: tabela */}
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">{rows.length} usuários</p>
            {orphanCount > 0 && (
              <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full font-medium">
                {orphanCount} sem base
              </span>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Usuário</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Base(s)</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Função</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cadastrado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(u => (
                <tr key={u.id} className={u.isOrphan ? 'bg-yellow-50/50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{u.name || u.email}</p>
                    {u.name && <p className="text-xs text-gray-400">{u.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {u.isOrphan ? (
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="size-3" /> Sem base
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.links.filter(l => l.organization_id).map(l => (
                          <Link
                            key={l.id}
                            href={`/superadmin/bases/${l.organizations?.id}`}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                              l.active
                                ? 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100'
                                : 'bg-gray-50 text-gray-400 border-gray-200 line-through'
                            }`}
                          >
                            {l.organizations?.name ?? l.organization_id}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.links.length === 0 ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        u.links.slice(0, 2).map(l => (
                          <span key={l.id} className="text-xs text-gray-600">
                            {l.roles?.label ?? l.roles?.name ?? '—'}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-3">
          {rows.map(u => (
            <div
              key={u.id}
              className={`rounded-xl border p-4 ${u.isOrphan ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{u.name || u.email}</p>
                  {u.name && <p className="text-xs text-gray-400 truncate">{u.email}</p>}
                </div>
                {u.isOrphan && (
                  <span className="flex-shrink-0 text-xs text-yellow-700 bg-yellow-100 border border-yellow-200 px-2 py-0.5 rounded-full">
                    Sem base
                  </span>
                )}
              </div>
              {!u.isOrphan && u.links.filter(l => l.organization_id).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {u.links.filter(l => l.organization_id).map(l => (
                    <Link
                      key={l.id}
                      href={`/superadmin/bases/${l.organizations?.id}`}
                      className="text-xs px-2 py-0.5 bg-brand-50 text-brand-700 border border-brand-200 rounded-full"
                    >
                      {l.organizations?.name ?? '—'}
                    </Link>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Cadastrado em {new Date(u.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
        </div>

      </main>
    </>
  )
}
