import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { MANAGEMENT_ROLES } from '@/lib/auth/permissions'
import { notFound, redirect } from 'next/navigation'
import { revokeEmergencyAccess } from '../[personId]/emergencia/actions'
import { REASON_LABELS } from '../[personId]/emergencia/constants'

type Props = { params: Promise<{ slug: string }> }

type GrantRow = {
  id: string
  reason_category: string
  reason_text: string
  granted_at: string
  expires_at: string
  revoked_at: string | null
  requested_by: string
  people: { full_name: string } | null
}

export default async function EmergenciaPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!MANAGEMENT_ROLES.includes(role as never)) redirect(`/${slug}/pessoas`)

  const db = createAdminClient()
  const [{ data: grantsRaw }, { data: { users: authUsers } }] = await Promise.all([
    db
      .from('person_emergency_access')
      .select('id, reason_category, reason_text, granted_at, expires_at, revoked_at, requested_by, people(full_name)')
      .eq('organization_id', org.id)
      .order('granted_at', { ascending: false })
      .limit(100),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const grants = ((grantsRaw ?? []) as unknown) as GrantRow[]
  const now = new Date().toISOString()
  const emailById = new Map(authUsers.filter(u => u.email).map(u => [u.id, u.email!]))

  return (
    <>
      <Header title="Acessos de emergência" backHref={`/${slug}/pessoas`} />
      <main className="p-4 md:p-6 max-w-3xl space-y-3">
        <p className="text-xs text-gray-400 -mt-2">
          Todo acesso de emergência que um líder abriu ao perfil de alguém — ativo ou já expirado.
        </p>

        {grants.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-sm text-gray-400">Nenhum acesso de emergência registrado ainda.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {grants.map(g => {
              const isActive = !g.revoked_at && g.expires_at > now
              const requesterEmail = emailById.get(g.requested_by) ?? '—'
              return (
                <div key={g.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">{g.people?.full_name ?? '—'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-amber-100 text-amber-700' : g.revoked_at ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                      {isActive ? 'Ativo' : g.revoked_at ? 'Revogado' : 'Expirado'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Solicitado por {requesterEmail} em {new Date(g.granted_at).toLocaleString('pt-BR')}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">{REASON_LABELS[g.reason_category] ?? g.reason_category}</span> — &ldquo;{g.reason_text}&rdquo;
                  </p>
                  {isActive && (
                    <form action={revokeEmergencyAccess} className="mt-2">
                      <input type="hidden" name="grant_id" value={g.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <button type="submit" className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Revogar agora
                      </button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
