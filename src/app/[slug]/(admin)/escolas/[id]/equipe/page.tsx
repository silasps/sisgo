import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import {
  assignSchoolLeader, removeSchoolLeader,
  addSchoolStaff, removeSchoolStaff,
  submitSchoolObreiroRequest, approveSchoolObreiroRequest,
  rejectSchoolObreiroRequest, cancelSchoolObreiroRequest,
} from '../actions'
import { isManagementRole, isOperationalManager } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'

type Props = {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ msg?: string }>
}

export default async function EscolaEquipePage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { msg } = await searchParams
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()
  const orgId = org.id

  const { role } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const isManagement = isManagementRole(role)
  const canWrite = isOperationalManager(role)
  const isLiderEted = role === 'lider_eted'

  type StaffRaw = { id: string; person_id: string; role: string; people: { full_name: string } | null }
  const { data: staffData } = await supabase
    .from('school_staff').select('id, person_id, role, people(full_name)')
    .eq('school_id', id).eq('active', true).order('joined_at', { ascending: true })
  const staffMembers = (staffData ?? []) as unknown as StaffRaw[]

  type ObreiroReqRow = {
    id: string; role: string; notes: string | null; status: string
    requested_by: string; person_id: string | null; created_at: string; review_notes: string | null
    people: { full_name: string } | null
  }

  let pendingRequests: ObreiroReqRow[] = []
  if (canWrite) {
    const { data } = await supabase
      .from('school_pending_requests')
      .select('id, role, notes, status, requested_by, person_id, created_at, review_notes, people(full_name)')
      .eq('school_id', id).eq('status', 'pendente').order('created_at', { ascending: true })
    pendingRequests = (data ?? []) as unknown as ObreiroReqRow[]
  }

  let myRequests: ObreiroReqRow[] = []
  if (isLiderEted) {
    const { data } = await supabase
      .from('school_pending_requests')
      .select('id, role, notes, status, requested_by, person_id, created_at, review_notes, people(full_name)')
      .eq('school_id', id).eq('requested_by', user.id)
      .not('status', 'in', '("cancelado")').order('created_at', { ascending: false }).limit(10)
    myRequests = (data ?? []) as unknown as ObreiroReqRow[]
  }

  const staffPersonIds = new Set(staffMembers.map(s => s.person_id))
  const { data: allPeople } = await supabase
    .from('people').select('id, full_name').eq('organization_id', orgId).order('full_name')
  const availablePeople = (allPeople ?? []).filter(p => !staffPersonIds.has(p.id))

  let leaderEmail: string | null = null
  let orgUsersForAssignment: Array<{ id: string; email: string }> = []

  if (isManagement) {
    const { data: leaderRow } = await supabase
      .from('school_leaders').select('user_id').eq('school_id', id).single()
    if (leaderRow) {
      const { data: { user: lu } } = await sbAdmin.auth.admin.getUserById(leaderRow.user_id)
      leaderEmail = lu?.email ?? null
    }
    const { data: orgUsersData } = await supabase
      .from('organization_users').select('user_id').eq('organization_id', orgId).eq('active', true)
    if (orgUsersData?.length) {
      const { data: { users: authUsers } } = await sbAdmin.auth.admin.listUsers({ perPage: 1000 })
      const orgUserSet = new Set(orgUsersData.map(u => u.user_id))
      orgUsersForAssignment = authUsers
        .filter(u => orgUserSet.has(u.id) && u.id !== (leaderRow?.user_id ?? ''))
        .map(u => ({ id: u.id, email: u.email ?? u.id }))
        .sort((a, b) => a.email.localeCompare(b.email))
    }
  }

  const base = `/${slug}/escolas/${id}/equipe`
  const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

  const handleAddStaff = async (formData: FormData) => {
    'use server'
    const personId = formData.get('person_id') as string
    if (!personId) return
    await addSchoolStaff(id, personId, (formData.get('role') as string) || 'Obreiro')
    redirect(base)
  }
  const handleRemoveStaff = async (formData: FormData) => {
    'use server'
    await removeSchoolStaff(formData.get('staff_id') as string)
    redirect(base)
  }
  const handleApproveObreiro = async (formData: FormData) => {
    'use server'
    await approveSchoolObreiroRequest(formData.get('request_id') as string, user.id)
    redirect(base)
  }
  const handleRejectObreiro = async (formData: FormData) => {
    'use server'
    await rejectSchoolObreiroRequest(formData.get('request_id') as string, user.id, (formData.get('review_notes') as string) || null)
    redirect(base)
  }
  const handleSubmitObreiro = async (formData: FormData) => {
    'use server'
    const personId = formData.get('person_id') as string
    if (!personId) return
    await submitSchoolObreiroRequest(orgId, id, user.id, personId, (formData.get('role') as string) || 'Obreiro', (formData.get('notes') as string) || null)
    redirect(`${base}?msg=enviada`)
  }
  const handleCancelObreiro = async (formData: FormData) => {
    'use server'
    await cancelSchoolObreiroRequest(formData.get('request_id') as string)
    redirect(base)
  }
  const handleAssignLeader = async (formData: FormData) => {
    'use server'
    const userId = formData.get('user_id') as string
    if (!userId) return
    const sb = createAdminClient()
    const { data: liderRole } = await sb.from('roles').select('id').eq('name', 'lider_eted').single()
    if (liderRole) {
      await sb.from('organization_users')
        .update({ role_id: liderRole.id, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('organization_id', orgId)
    }
    await assignSchoolLeader(orgId, id, userId)
    redirect(`${base}?msg=lider_atribuido`)
  }
  const handleRemoveLeader = async () => {
    'use server'
    await removeSchoolLeader(id)
    redirect(base)
  }

  const msgs: Record<string, { text: string; cls: string }> = {
    enviada: { text: 'Solicitação enviada.', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    lider_atribuido: { text: 'Líder atribuído.', cls: 'bg-green-50 border-green-200 text-green-700' },
  }
  const msgInfo = msg ? msgs[msg] : null

  return (
    <main className="p-4 md:p-6 space-y-4 max-w-3xl overflow-y-auto flex-1">
      <p className="text-xs text-gray-400 -mt-2">
        Vínculo de líderes e obreiros com esta escola — quem serve aqui e com que papel.
      </p>

      {msgInfo && (
        <div className={`border rounded-lg px-4 py-3 text-sm ${msgInfo.cls}`}>{msgInfo.text}</div>
      )}

      {/* Líder */}
      {isManagement && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Líder da Escola</h3>
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
                <button type="submit" className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors">Confirmar</button>
              </form>
            </details>
          )}
        </div>
      )}

      {/* Obreiros */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Obreiros ({staffMembers.length})</h2>
        {staffMembers.length > 0 ? (
          <ul className="divide-y divide-gray-100 mb-3">
            {staffMembers.map(s => (
              <li key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-900">{s.people?.full_name ?? '—'}</span>
                  <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s.role}</span>
                </div>
                {canWrite && (
                  <form action={handleRemoveStaff} className="flex-shrink-0">
                    <input type="hidden" name="staff_id" value={s.id} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">Remover</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 mb-3">Nenhum obreiro ainda.</p>
        )}

        {/* DH: add direto */}
        {canWrite && availablePeople.length > 0 && (
          <details className={staffMembers.length > 0 ? 'border-t border-gray-100 pt-3' : ''}>
            <summary className="text-sm text-brand-600 cursor-pointer select-none font-medium">+ Adicionar obreiro</summary>
            <form action={handleAddStaff} className="mt-3 flex flex-wrap gap-2">
              <select name="person_id" required className={`flex-1 min-w-0 ${INPUT}`}>
                <option value="">Selecionar pessoa...</option>
                {availablePeople.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors">Adicionar</button>
            </form>
          </details>
        )}

        {/* Líder: solicitar adição */}
        {isLiderEted && availablePeople.length > 0 && (
          <details className={staffMembers.length > 0 ? 'border-t border-gray-100 pt-3' : ''}>
            <summary className="text-sm text-brand-600 cursor-pointer select-none font-medium">+ Solicitar adição de obreiro</summary>
            <form action={handleSubmitObreiro} className="mt-3 space-y-2">
              <select name="person_id" required className={INPUT}>
                <option value="">Selecionar pessoa...</option>
                {availablePeople.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              <input name="notes" placeholder="Observação (opcional)" className={INPUT} />
              <button type="submit" className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors">Enviar Solicitação</button>
            </form>
          </details>
        )}
      </div>

      {/* DH: requests pendentes */}
      {canWrite && pendingRequests.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Solicitações Pendentes
            <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">{pendingRequests.length}</span>
          </h2>
          <ul className="space-y-3">
            {pendingRequests.map(req => (
              <li key={req.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-gray-800">{req.people?.full_name ?? '—'}</p>
                {req.notes && <p className="text-xs text-gray-400 italic">&ldquo;{req.notes}&rdquo;</p>}
                <div className="flex gap-2">
                  <form action={handleApproveObreiro}><input type="hidden" name="request_id" value={req.id} /><button type="submit" className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors">Aprovar</button></form>
                  <form action={handleRejectObreiro} className="flex gap-1">
                    <input type="hidden" name="request_id" value={req.id} />
                    <input name="review_notes" placeholder="Motivo..." className="border border-gray-200 rounded px-2 py-1 text-xs w-28" />
                    <button type="submit" className="px-3 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors">Rejeitar</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Líder: minhas solicitações */}
      {isLiderEted && myRequests.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Minhas Solicitações</h2>
          <ul className="divide-y divide-gray-100">
            {myRequests.map(req => {
              const statusMap: Record<string, { label: string; cls: string }> = {
                pendente: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-700' },
                aprovado: { label: 'Aprovado', cls: 'bg-green-100 text-green-700' },
                rejeitado: { label: 'Rejeitado', cls: 'bg-red-100 text-red-600' },
              }
              const st = statusMap[req.status] ?? { label: req.status, cls: 'bg-gray-100 text-gray-500' }
              return (
                <li key={req.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm text-gray-700">{req.people?.full_name ?? '—'}</span>
                    <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                    {req.review_notes && <p className="text-xs text-gray-400 mt-0.5">{req.review_notes}</p>}
                  </div>
                  {req.status === 'pendente' && (
                    <form action={handleCancelObreiro} className="flex-shrink-0">
                      <input type="hidden" name="request_id" value={req.id} />
                      <button type="submit" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Cancelar</button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </main>
  )
}
