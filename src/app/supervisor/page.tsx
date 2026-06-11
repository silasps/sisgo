import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { asLooseClient } from '@/lib/supabase/loose-client'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type SupervisedOrgId = { organization_id: string }
type Org = { id: string; name: string; slug: string; city: string | null; state: string | null; active: boolean }

export default async function SupervisorBasesPage() {
  const supabase = await createClient()
  const admin = asLooseClient(createAdminClient())

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgIdsData } = await admin.rpc('supervised_base_ids', { target_user_id: user.id })
  const orgIds = ((orgIdsData ?? []) as SupervisedOrgId[]).map(item => item.organization_id)

  const { data: orgsData } = orgIds.length
    ? await admin.from('organizations').select('id, name, slug, city, state, active').in('id', orgIds).order('name')
    : { data: [] }

  const orgs = (orgsData ?? []) as Org[]

  return (
    <>
      <Header title="Minhas bases supervisionadas" />
      <main className="p-4 md:p-6">
        {orgs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-sm text-gray-500">Você ainda não possui bases vinculadas para supervisão.</p>
            <p className="mt-1 text-xs text-gray-400">Peça ao super admin para vincular seu usuário a um grupo ou a bases específicas.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map(org => (
              <Link
                key={org.id}
                href={`/${org.slug}/dashboard`}
                className="group block rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-brand-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{org.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-gray-400">/{org.slug}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${org.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {org.active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                {(org.city || org.state) && (
                  <p className="mt-3 text-xs text-gray-500">{[org.city, org.state].filter(Boolean).join(', ')}</p>
                )}
                <span className="mt-4 block rounded-lg border border-brand-500 px-4 py-2 text-center text-sm font-medium text-brand-600 transition-colors group-hover:bg-brand-50">
                  Acessar base
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
