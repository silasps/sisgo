import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SearchableSelectModal } from '@/components/ui/SearchableSelectModal'
import { assignMinistryLeaderByPerson, addMinistryCoLeaderByPerson, removeMinistryLeader } from './actions'

type Props = { slug: string; ministryId: string; orgId: string; canAssignLeader: boolean }

export async function LeaderPanel({ slug, ministryId, orgId, canAssignLeader }: Props) {
  const sbAdmin = createAdminClient()

  const { data: leaderRows } = await sbAdmin
    .from('ministry_leaders')
    .select('user_id')
    .eq('ministry_id', ministryId)

  const leaderUserIds = (leaderRows ?? []).map(r => r.user_id)
  let leaders: Array<{ userId: string; email: string | null }> = []
  if (leaderUserIds.length > 0) {
    leaders = await Promise.all(leaderUserIds.map(async userId => {
      const { data: { user: lu } } = await sbAdmin.auth.admin.getUserById(userId)
      return { userId, email: lu?.email ?? null }
    }))
  }

  // Busca entre TODAS as pessoas da base, não só quem já tem login — mesmo
  // padrão da "Liderança da Escola" (ver escolas/[id]/configuracoes/page.tsx).
  let peopleForAssignment: Array<{ id: string; label: string }> = []
  if (canAssignLeader) {
    const [{ data: peopleData }, { data: staffRows }] = await Promise.all([
      sbAdmin.from('people').select('id, full_name').eq('organization_id', orgId).order('full_name'),
      sbAdmin.from('staff_profiles').select('person_id, user_id').eq('organization_id', orgId).not('user_id', 'is', null),
    ])
    const leaderUserIdSet = new Set(leaderUserIds)
    const userIdByPersonId = new Map((staffRows ?? []).map(s => [s.person_id, s.user_id as string]))
    peopleForAssignment = (peopleData ?? [])
      .filter(p => {
        const uid = userIdByPersonId.get(p.id)
        return !uid || !leaderUserIdSet.has(uid)
      })
      .map(p => ({ id: p.id, label: p.full_name }))
  }

  const handleAssignLeader = async (formData: FormData) => {
    'use server'
    const personId = formData.get('person_id') as string
    if (!personId) return
    const result = await assignMinistryLeaderByPerson(orgId, ministryId, personId)
    if (result.error) redirect(`/${slug}/ministerios/${ministryId}?erro=${encodeURIComponent(result.error)}`)
    redirect(`/${slug}/ministerios/${ministryId}?msg=lider_atribuido`)
  }

  const handleAddCoLeader = async (formData: FormData) => {
    'use server'
    const personId = formData.get('person_id') as string
    if (!personId) return
    const result = await addMinistryCoLeaderByPerson(orgId, ministryId, personId)
    if (result.error) redirect(`/${slug}/ministerios/${ministryId}?erro=${encodeURIComponent(result.error)}`)
    redirect(`/${slug}/ministerios/${ministryId}?msg=lider_atribuido`)
  }

  const handleRemoveLeader = async (formData: FormData) => {
    'use server'
    const userId = formData.get('user_id') as string
    if (!userId) return
    await removeMinistryLeader(ministryId, userId)
    redirect(`/${slug}/ministerios/${ministryId}`)
  }

  return (
    <div className="hidden lg:block bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Líder</h3>
      {leaders.length > 0 ? (
        <ul className="space-y-1.5">
          {leaders.map(l => (
            <li key={l.userId} className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-900 truncate">{l.email}</p>
              <form action={handleRemoveLeader}>
                <input type="hidden" name="user_id" value={l.userId} />
                <button type="submit" className="text-[10px] text-red-400 hover:text-red-600 transition-colors">Remover</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400">Sem líder atribuído.</p>
      )}
      {canAssignLeader && (
        peopleForAssignment.length > 0 ? (
          <details className={leaders.length > 0 ? 'mt-2 border-t border-gray-100 pt-2' : 'mt-2'}>
            <summary className="text-xs text-brand-600 cursor-pointer select-none font-medium">
              {leaders.length > 0 ? '+ Adicionar colíder' : 'Atribuir líder'}
            </summary>
            <form action={leaders.length > 0 ? handleAddCoLeader : handleAssignLeader} className="mt-2 space-y-1.5">
              <SearchableSelectModal
                name="person_id"
                options={peopleForAssignment}
                title="Selecionar pessoa"
              />
              <p className="text-[10px] text-gray-400">
                Busca qualquer pessoa cadastrada na base. Quem ainda não tem login ganha um automaticamente.
              </p>
              <button type="submit" className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors">
                Confirmar
              </button>
            </form>
          </details>
        ) : (
          <p className="text-[10px] text-gray-400 mt-2">Nenhuma outra pessoa cadastrada na base.</p>
        )
      )}
    </div>
  )
}
