import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { assignLeader, removeLeader } from './actions'

type Props = { slug: string; ministryId: string; orgId: string }

export async function LeaderPanel({ slug, ministryId, orgId }: Props) {
  const sbAdmin = createAdminClient()

  const { data: leaderRow } = await sbAdmin
    .from('ministry_leaders')
    .select('user_id')
    .eq('ministry_id', ministryId)
    .single()
  const leaderUserId = leaderRow?.user_id ?? null

  let leaderEmail: string | null = null
  if (leaderUserId) {
    const { data: { user: lu } } = await sbAdmin.auth.admin.getUserById(leaderUserId)
    leaderEmail = lu?.email ?? null
  }

  const { data: orgUsersData } = await sbAdmin
    .from('organization_users')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('active', true)

  let orgUsersForAssignment: Array<{ id: string; email: string }> = []
  if (orgUsersData?.length) {
    const { data: { users: authUsers } } = await sbAdmin.auth.admin.listUsers({ perPage: 1000 })
    const orgUserSet = new Set(orgUsersData.map(u => u.user_id))
    orgUsersForAssignment = authUsers
      .filter(u => orgUserSet.has(u.id) && u.id !== (leaderUserId ?? ''))
      .map(u => ({ id: u.id, email: u.email ?? u.id }))
      .sort((a, b) => a.email.localeCompare(b.email))
  }

  const handleAssignLeader = async (formData: FormData) => {
    'use server'
    const userId = formData.get('user_id') as string
    if (!userId) return
    const sb = createAdminClient()
    const { data: liderRole } = await sb.from('roles').select('id').eq('name', 'lider_ministerio').single()
    if (liderRole) {
      await sb.from('organization_users')
        .update({ role_id: liderRole.id, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('organization_id', orgId)
    }
    await assignLeader(orgId, ministryId, userId)
    redirect(`/${slug}/ministerios/${ministryId}?msg=lider_atribuido`)
  }

  const handleRemoveLeader = async () => {
    'use server'
    await removeLeader(ministryId)
    redirect(`/${slug}/ministerios/${ministryId}`)
  }

  const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

  return (
    <div className="hidden lg:block bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Líder</h3>
      {leaderEmail ? (
        <div>
          <p className="text-sm font-medium text-gray-900 truncate">{leaderEmail}</p>
          <form action={handleRemoveLeader} className="mt-1">
            <button type="submit" className="text-[10px] text-red-400 hover:text-red-600 transition-colors">Remover</button>
          </form>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Sem líder atribuído.</p>
      )}
      {orgUsersForAssignment.length > 0 && (
        <details className="mt-2 border-t border-gray-100 pt-2">
          <summary className="text-xs text-brand-600 cursor-pointer select-none font-medium">
            {leaderEmail ? 'Trocar' : 'Atribuir'}
          </summary>
          <form action={handleAssignLeader} className="mt-2 space-y-1.5">
            <select name="user_id" required className={`${INPUT} text-xs`}>
              <option value="">Selecionar...</option>
              {orgUsersForAssignment.map(u => (
                <option key={u.id} value={u.id}>{u.email}</option>
              ))}
            </select>
            <button type="submit" className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors">
              Confirmar
            </button>
          </form>
        </details>
      )}
    </div>
  )
}
