import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'

function daysAgo(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

export default async function SuperAdminInscricoesPage() {
  const db = createAdminClient()

  const [{ data: orgUsersRaw }, { data: authData }, { data: orgs }] = await Promise.all([
    db.from('organization_users').select('user_id').eq('active', true),
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from('organizations').select('id, name, slug').eq('active', true).order('name'),
  ])

  const assignedIds = new Set((orgUsersRaw ?? []).map(r => r.user_id))

  const loose = (authData.users ?? [])
    .filter(u => !assignedIds.has(u.id) && !u.is_anonymous)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <>
      <Header title="Inscrições Soltas" />
      <main className="p-4 md:p-6 space-y-4">

        <p className="text-sm text-gray-500">
          Usuários que criaram conta no sistema mas ainda não foram vinculados a nenhuma base.
        </p>

        {loose.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-400 text-sm">Nenhum usuário sem base.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {loose.map(u => {
              const name = (u.user_metadata?.full_name ?? u.user_metadata?.name ?? '') as string
              const provider = (u.app_metadata?.provider ?? 'email') as string
              const dias = daysAgo(u.created_at)
              return (
                <div key={u.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{name || u.email}</p>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        {provider}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        dias === 0 ? 'bg-green-100 text-green-700'
                        : dias <= 3 ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-500'
                      }`}>{dias === 0 ? 'Hoje' : `${dias}d`}</span>
                    </div>
                    {name && <p className="text-xs text-gray-400">{u.email}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    {(orgs ?? []).map(org => (
                      <Link
                        key={org.id}
                        href={`/${org.slug}/obreiros`}
                        className="px-3 py-1.5 text-xs font-medium bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-lg transition-colors"
                      >
                        → {org.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
