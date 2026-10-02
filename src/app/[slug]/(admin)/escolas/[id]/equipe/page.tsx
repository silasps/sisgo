import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import {
  assignSchoolLeaderByPerson, addSchoolCoLeaderByPerson, removeSchoolLeader,
  addSchoolStaffBatch, removeSchoolStaff,
  submitSchoolObreiroRequest, approveSchoolObreiroRequest,
  rejectSchoolObreiroRequest, cancelSchoolObreiroRequest,
} from '../actions'
import { isManagementRole, isOperationalManager, canAssignLeadership } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { getSchoolLink } from '@/lib/auth/unit-access'
import { MultiSelectModal } from '@/components/ui/MultiSelectModal'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { EnviarFormularioObreiroDiretoButton } from '@/components/inscricoes/EnviarFormularioObreiroDiretoButton'
import { setTeacherLodgingAccess, getTeacherLodgingAccessMap } from '@/lib/school/teacherVisitRequests'

type Props = {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ msg?: string; pending?: string; erro?: string }>
}

export default async function EscolaEquipePage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { msg, pending, erro } = await searchParams
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }, { data: escola }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
    supabase.from('schools').select('name').eq('id', id).single(),
  ])
  if (!user || !org) notFound()
  const orgId = org.id

  const { role, preview } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const isManagement = isManagementRole(role)
  const canWrite = isOperationalManager(role)
  const canAssignLeader = canAssignLeadership(role)
  // Líder/obreiro DESTA escola (vínculo), não "tem papel lider_eted/obreiro_eted"
  // — ver lib/auth/unit-access. Quem já escreve direto (canWrite) não passa
  // pelo fluxo de solicitação ao DH.
  const mySchoolLink = canWrite ? null : await getSchoolLink({ userId: user.id, orgId, role, preview }, id)
  const isLiderEted = mySchoolLink === 'lider'
  // Quem pode ver/editar a permissão de hospedagem do professor por obreiro.
  const canManageLodgingAccess = canWrite || role === 'lider_base' || isLiderEted

  type StaffRaw = { id: string; person_id: string; role: string; people: { full_name: string; birth_date: string | null } | null }
  const { data: staffData } = await supabase
    .from('school_staff').select('id, person_id, role, people(full_name, birth_date)')
    .eq('school_id', id).eq('active', true).order('joined_at', { ascending: true })
  const staffMembers = (staffData ?? []) as unknown as StaffRaw[]

  const lodgingAccessMap = canManageLodgingAccess
    ? await getTeacherLodgingAccessMap(id, staffMembers.map(s => s.person_id))
    : new Map<string, boolean>()

  // Quem também serve ativamente em outra escola/ministério — mostra como
  // tag "também em" (sem bloquear nada, só pra ficar visível pro DH onde
  // essa pessoa está "emprestada"). Independe do fluxo de aprovação de
  // staff_loans: cobre também quem entrou via "Solicitar adição" (líder
  // pede → DH aprova), que não passa pela checagem de empréstimo.
  const otherUnitByPerson = new Map<string, string>()
  if (staffMembers.length > 0) {
    const personIds = staffMembers.map(s => s.person_id)
    const [{ data: otherSchoolRows }, { data: otherMinistryRows }] = await Promise.all([
      sbAdmin.from('school_staff').select('person_id, schools(name)').in('person_id', personIds).eq('active', true).neq('school_id', id),
      sbAdmin.from('ministry_members').select('person_id, ministries(name)').in('person_id', personIds).eq('active', true),
    ])
    for (const r of (otherSchoolRows ?? []) as unknown as Array<{ person_id: string; schools: { name: string } | null }>) {
      if (r.schools?.name) otherUnitByPerson.set(r.person_id, r.schools.name)
    }
    for (const r of (otherMinistryRows ?? []) as unknown as Array<{ person_id: string; ministries: { name: string } | null }>) {
      if (r.ministries?.name && !otherUnitByPerson.has(r.person_id)) otherUnitByPerson.set(r.person_id, r.ministries.name)
    }
  }

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

  // Uma escola pode ter mais de um líder (colíderes) — school_leaders só tem
  // unique(school_id, user_id), não um líder único por escola.
  let leaders: Array<{ userId: string; email: string | null }> = []
  // Busca entre TODAS as pessoas da base, não só quem já tem login — quem
  // ainda não tem ganha um na hora (ver resolvePersonToUserId em ../actions).
  let peopleForAssignment: Array<{ id: string; label: string }> = []

  if (isManagement) {
    const { data: leaderRows } = await supabase
      .from('school_leaders').select('user_id').eq('school_id', id)
    const leaderUserIds = (leaderRows ?? []).map(r => r.user_id)
    if (leaderUserIds.length > 0) {
      leaders = await Promise.all(leaderUserIds.map(async userId => {
        const { data: { user: lu } } = await sbAdmin.auth.admin.getUserById(userId)
        return { userId, email: lu?.email ?? null }
      }))
    }
    if (canAssignLeader) {
      const { data: staffRows } = await sbAdmin
        .from('staff_profiles').select('person_id, user_id').eq('organization_id', orgId).not('user_id', 'is', null)
      const leaderUserIdSet = new Set(leaderUserIds)
      const userIdByPersonId = new Map((staffRows ?? []).map(s => [s.person_id, s.user_id as string]))
      peopleForAssignment = (allPeople ?? [])
        .filter(p => {
          const uid = userIdByPersonId.get(p.id)
          return !uid || !leaderUserIdSet.has(uid)
        })
        .map(p => ({ id: p.id, label: p.full_name }))
    }
  }

  // Empréstimos de saída: obreiros DESTA escola que alguém quis adicionar
  // em outra escola/ministério — precisam da aprovação do líder daqui.
  type LoanRaw = {
    id: string; person_id: string; to_unit_type: string; role: string | null
    starts_on: string; ends_on: string; created_at: string
    people: { full_name: string } | null
  }
  let outgoingLoans: Array<LoanRaw & { destinationName: string | null }> = []
  if (canWrite || isLiderEted) {
    const { data } = await sbAdmin
      .from('staff_loans')
      .select('id, person_id, to_unit_type, to_school_id, to_ministry_id, role, starts_on, ends_on, created_at, people(full_name)')
      .eq('from_school_id', id).eq('status', 'pendente').order('created_at', { ascending: true })
    const rows = (data ?? []) as unknown as Array<LoanRaw & { to_school_id: string | null; to_ministry_id: string | null }>
    const schoolIds = [...new Set(rows.filter(r => r.to_unit_type === 'school').map(r => r.to_school_id).filter((v): v is string => !!v))]
    const ministryIds = [...new Set(rows.filter(r => r.to_unit_type === 'ministry').map(r => r.to_ministry_id).filter((v): v is string => !!v))]
    const [{ data: schoolsData }, { data: ministriesData }] = await Promise.all([
      schoolIds.length > 0 ? sbAdmin.from('schools').select('id, name').in('id', schoolIds) : Promise.resolve({ data: [] }),
      ministryIds.length > 0 ? sbAdmin.from('ministries').select('id, name').in('id', ministryIds) : Promise.resolve({ data: [] }),
    ])
    const schoolNameById = new Map((schoolsData ?? []).map(s => [s.id, s.name]))
    const ministryNameById = new Map((ministriesData ?? []).map(m => [m.id, m.name]))
    outgoingLoans = rows.map(r => ({
      ...r,
      destinationName: r.to_unit_type === 'school' ? (schoolNameById.get(r.to_school_id ?? '') ?? null) : (ministryNameById.get(r.to_ministry_id ?? '') ?? null),
    }))
  }

  const base = `/${slug}/escolas/${id}/equipe`
  const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
  const todayStr = new Date().toISOString().slice(0, 10)

  const handleAddStaff = async (formData: FormData) => {
    'use server'
    const personIds = formData.getAll('person_id') as string[]
    if (personIds.length === 0) return
    const startsOn = (formData.get('starts_on') as string) || new Date().toISOString().slice(0, 10)
    const endsOn = formData.get('ends_on') as string
    if (!endsOn) return
    const result = await addSchoolStaffBatch({
      orgId, schoolId: id, personIds, role: (formData.get('role') as string) || 'Obreiro',
      requestedBy: user.id, startsOn, endsOn,
    })
    redirect(result.pendingLoans > 0 ? `${base}?pending=${result.pendingLoans}` : base)
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
    const personId = formData.get('person_id') as string
    if (!personId) return
    const result = await assignSchoolLeaderByPerson(orgId, id, personId)
    if (result.error) redirect(`${base}?erro=${encodeURIComponent(result.error)}`)
    redirect(`${base}?msg=lider_atribuido`)
  }
  const handleAddCoLeader = async (formData: FormData) => {
    'use server'
    const personId = formData.get('person_id') as string
    if (!personId) return
    const result = await addSchoolCoLeaderByPerson(orgId, id, personId)
    if (result.error) redirect(`${base}?erro=${encodeURIComponent(result.error)}`)
    redirect(`${base}?msg=lider_atribuido`)
  }
  const handleRemoveLeader = async (formData: FormData) => {
    'use server'
    const userId = formData.get('user_id') as string
    if (!userId) return
    await removeSchoolLeader(id, userId, orgId)
    redirect(base)
  }
  const handleApproveLoan = async (formData: FormData) => {
    'use server'
    const { approveStaffLoan } = await import('@/lib/staff-loans')
    await approveStaffLoan(formData.get('loan_id') as string, user.id, (formData.get('recommendation') as string)?.trim() || null)
    redirect(base)
  }
  const handleRejectLoan = async (formData: FormData) => {
    'use server'
    const { rejectStaffLoan } = await import('@/lib/staff-loans')
    await rejectStaffLoan(formData.get('loan_id') as string, user.id, (formData.get('recommendation') as string)?.trim() || null)
    redirect(base)
  }
  const handleEnviarFormularioDireto = async (formData: FormData) => {
    'use server'
    const { inviteSchoolStaffDirect } = await import('../actions')
    return inviteSchoolStaffDirect({
      slug,
      organizationId: orgId,
      schoolId: id,
      fullName: (formData.get('full_name') as string)?.trim() ?? '',
      email: (formData.get('email') as string) || null,
      phone: (formData.get('phone') as string) || null,
      message: (formData.get('message') as string) || null,
      createdBy: user.id,
    })
  }
  const handleSetLodgingAccess = async (formData: FormData) => {
    'use server'
    const personId = formData.get('person_id') as string
    if (!personId) return
    await setTeacherLodgingAccess({
      organizationId: orgId,
      schoolId: id,
      personId,
      canView: formData.get('can_view') === 'sim',
      setBy: user.id,
    })
    redirect(base)
  }

  const msgs: Record<string, { text: string; cls: string }> = {
    enviada: { text: 'Solicitação enviada.', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    lider_atribuido: { text: 'Líder atribuído.', cls: 'bg-green-50 border-green-200 text-green-700' },
  }
  const msgInfo = msg ? msgs[msg] : null
  const formatBirthday = (birthDate: string | null) => birthDate
    ? new Date(`${birthDate}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null

  return (
    <main className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
      <div className="max-w-3xl mx-auto w-full space-y-4">
      <p className="text-xs text-gray-400 -mt-2">
        Vínculo de líderes e obreiros com esta escola — quem serve aqui e com que papel.
      </p>

      {msgInfo && (
        <div className={`border rounded-lg px-4 py-3 text-sm ${msgInfo.cls}`}>{msgInfo.text}</div>
      )}
      {erro && (
        <div className="border rounded-lg px-4 py-3 text-sm bg-red-50 border-red-200 text-red-700">{erro}</div>
      )}
      {pending && Number(pending) > 0 && (
        <div className="border rounded-lg px-4 py-3 text-sm bg-amber-50 border-amber-200 text-amber-700">
          {Number(pending) === 1
            ? '1 pessoa já serve em outra escola/ministério — aguardando aprovação do líder de origem (ver Pendências).'
            : `${pending} pessoas já servem em outra escola/ministério — aguardando aprovação do líder de origem (ver Pendências).`}
        </div>
      )}

      {(canWrite || isLiderEted) && (
        <div className="flex justify-end">
          <EnviarFormularioObreiroDiretoButton
            slug={slug}
            action={handleEnviarFormularioDireto}
            fixedDestination={{ type: 'school', id, label: escola?.name ?? 'esta escola' }}
          />
        </div>
      )}

      {/* Liderança */}
      {isManagement && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Liderança da Escola</h3>
          {leaders.length > 0 ? (
            <ul className="space-y-1">
              {leaders.map(l => (
                <li key={l.userId} className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{l.email}</p>
                  <form action={handleRemoveLeader}>
                    <input type="hidden" name="user_id" value={l.userId} />
                    <button type="submit" className="text-[10px] text-red-400 hover:text-red-600 transition-colors flex-shrink-0">Remover</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">Sem líder atribuído.</p>
          )}
          {canAssignLeader && peopleForAssignment.length > 0 && (
            <details className="mt-2 border-t border-gray-100 pt-2">
              <summary className="text-xs text-brand-600 cursor-pointer select-none font-medium">
                {leaders.length > 0 ? '+ Adicionar colíder' : 'Atribuir'}
              </summary>
              <form action={leaders.length > 0 ? handleAddCoLeader : handleAssignLeader} className="mt-2 space-y-1.5">
                <select name="person_id" required className={`${INPUT} text-xs`}>
                  <option value="">Selecionar...</option>
                  {peopleForAssignment.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <button type="submit" className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors">Confirmar</button>
              </form>
            </details>
          )}
        </div>
      )}

      {/* Empréstimos pendentes — obreiro desta escola pedido em outro lugar */}
      {outgoingLoans.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 p-5">
          <h2 className="text-sm font-semibold text-amber-700 mb-3">
            Empréstimos Pendentes
            <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{outgoingLoans.length}</span>
          </h2>
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            {outgoingLoans.map(loan => (
              <li key={loan.id} className="border border-amber-100 rounded-lg p-3 space-y-2">
                <div className="text-sm">
                  <p className="font-medium text-gray-800">{loan.people?.full_name ?? '—'}</p>
                  <p className="text-xs text-gray-500">
                    Pedido para {loan.to_unit_type === 'school' ? 'a escola' : 'o ministério'} <strong>{loan.destinationName ?? '—'}</strong>
                    {loan.role ? ` como ${loan.role}` : ''}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(`${loan.starts_on}T00:00:00`).toLocaleDateString('pt-BR')}
                    {' – '}
                    {new Date(`${loan.ends_on}T00:00:00`).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <form action={handleApproveLoan} className="space-y-1.5">
                  <input type="hidden" name="loan_id" value={loan.id} />
                  <input name="recommendation" placeholder="Recomendação sobre a pessoa (opcional)" className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  <div className="flex gap-2">
                    <button type="submit" className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors">Aprovar</button>
                    <button type="submit" formAction={handleRejectLoan} className="px-3 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors">Recusar</button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Obreiros */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Obreiros ({staffMembers.length})</h2>
        {staffMembers.length > 0 ? (
          <ul className="divide-y divide-gray-100 mb-3">
            {staffMembers.map(s => {
              const birthday = formatBirthday(s.people?.birth_date ?? null)
              const canView = lodgingAccessMap.get(s.person_id) ?? false
              return (
                <li key={s.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900">{s.people?.full_name ?? '—'}</span>
                      <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s.role}</span>
                      {birthday && <span className="ml-2 text-xs text-gray-400">🎂 {birthday}</span>}
                      {otherUnitByPerson.has(s.person_id) && (
                        <span className="ml-2 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          também em: {otherUnitByPerson.get(s.person_id)}
                        </span>
                      )}
                    </div>
                    {canWrite && (
                      <form action={handleRemoveStaff} className="flex-shrink-0">
                        <input type="hidden" name="staff_id" value={s.id} />
                        <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">Remover</button>
                      </form>
                    )}
                  </div>
                  {canManageLodgingAccess && (
                    <details className="mt-1">
                      <summary className="text-[11px] text-gray-400 hover:text-brand-600 cursor-pointer select-none">Permissões</summary>
                      <form action={handleSetLodgingAccess} className="mt-1.5 flex items-center gap-2">
                        <input type="hidden" name="person_id" value={s.person_id} />
                        <label className="flex items-center gap-1.5 text-xs text-gray-600">
                          <input type="checkbox" name="can_view" value="sim" defaultChecked={canView} className="rounded border-gray-300" />
                          Pode ver a hospedagem do professor visitante
                        </label>
                        <button type="submit" className="px-2 py-1 text-[11px] font-medium rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">Salvar</button>
                      </form>
                    </details>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 mb-3">Nenhum obreiro ainda.</p>
        )}

        {/* DH: add direto — seleção múltipla, tipo escolher participantes de um grupo */}
        {canWrite && availablePeople.length > 0 && (
          <details className={staffMembers.length > 0 ? 'border-t border-gray-100 pt-3' : ''}>
            <summary className="text-sm text-brand-600 cursor-pointer select-none font-medium">+ Adicionar obreiro</summary>
            <form action={handleAddStaff} className="mt-3 space-y-2">
              <MultiSelectModal
                name="person_id"
                options={availablePeople.map(p => ({ id: p.id, label: p.full_name }))}
                placeholder="Selecionar pessoas..."
                searchPlaceholder="Buscar por nome..."
                title="Selecionar pessoas"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] text-gray-400 mb-1">A partir de</label>
                  <input type="date" name="starts_on" defaultValue={todayStr} required className={INPUT} />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] text-gray-400 mb-1">Até</label>
                  <input type="date" name="ends_on" required className={INPUT} />
                </div>
              </div>
              <p className="text-[11px] text-gray-400">
                Usado só se alguém selecionado já servir em outro ministério/escola — vira um pedido de empréstimo pro líder de origem aprovar, com esse período (obrigatório: o líder precisa saber até quando pode contar sem a pessoa).
              </p>
              <SubmitButton pendingText="Adicionando…" className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white transition-colors">
                Adicionar
              </SubmitButton>
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
      </div>

      {/* DH: requests pendentes */}
      {canWrite && pendingRequests.length > 0 && (
        <div className="max-w-5xl mx-auto bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Solicitações Pendentes
            <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">{pendingRequests.length}</span>
          </h2>
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
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

      <div className="max-w-3xl mx-auto w-full space-y-4">
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
      </div>
    </main>
  )
}
