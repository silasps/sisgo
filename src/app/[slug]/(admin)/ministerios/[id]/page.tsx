import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import {
  updateMinistry, assignLeader, removeLeader,
  addMember, removeMember, approveRequest, rejectRequest,
  submitMemberRequest, cancelRequest, createServiceRequest,
  requestTransfer, respondTransferAsDestination, confirmTransferAsDH, cancelTransfer,
} from './actions'
import { isManagementRole } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'

type Props = {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ msg?: string }>
}

const REQUEST_LABELS: Record<string, string> = {
  add_member:    'Adicionar membro',
  remove_member: 'Remover membro',
  change_role:   'Alterar papel',
}

function daysAgo(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

export default async function MinisterioDetailPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { msg } = await searchParams

  const supabase = await createClient()
  const sbAdmin  = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()
  const orgId = org.id

  const { role, preview } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const isManagement       = isManagementRole(role)
  const isLiderMinisterio  = role === 'lider_ministerio'
  const isObreiroMinisterio = role === 'obreiro_ministerio'

  if (!isManagement && !isLiderMinisterio && !isObreiroMinisterio) notFound()

  const { data: ministry } = await supabase
    .from('ministries')
    .select('id, name, description, active')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!ministry) notFound()

  // Usuário vinculado só pode acessar o SEU ministério
  if (isLiderMinisterio) {
    if (preview?.ministryId) {
      if (preview.ministryId !== id) redirect(`/${slug}/ministerios`)
    } else {
      const { data: lc } = await supabase
        .from('ministry_leaders')
        .select('id')
        .eq('ministry_id', id)
        .eq('user_id', user.id)
        .single()
      if (!lc) redirect(`/${slug}/ministerios`)
    }
  }

  if (isObreiroMinisterio) {
    if (preview?.ministryId) {
      if (preview.ministryId !== id) redirect(`/${slug}/ministerios`)
    } else {
    const { data: staffProfile } = await supabase
      .from('staff_profiles')
      .select('person_id')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    const { data: memberLink } = staffProfile?.person_id
      ? await supabase
        .from('ministry_members')
        .select('id')
        .eq('ministry_id', id)
        .eq('person_id', staffProfile.person_id)
        .eq('active', true)
        .single()
      : { data: null }

    if (!memberLink) redirect(`/${slug}/ministerios`)
    }
  }

  // ── Membros ──────────────────────────────────────────────────────────────────
  type MemberRaw = {
    id: string; person_id: string; joined_at: string | null
    people: { full_name: string } | null
    ministry_roles: { id: string; name: string } | null
  }
  const { data: membersData } = await supabase
    .from('ministry_members')
    .select('id, person_id, joined_at, people(full_name), ministry_roles(id, name)')
    .eq('ministry_id', id)
    .eq('active', true)
    .order('joined_at', { ascending: true })
  const members = (membersData ?? []) as unknown as MemberRaw[]

  // ── Papéis do ministério ─────────────────────────────────────────────────────
  const { data: ministryRolesData } = await supabase
    .from('ministry_roles')
    .select('id, name')
    .eq('ministry_id', id)
  const ministryRoles = ministryRolesData ?? []

  // ── Líder atual ──────────────────────────────────────────────────────────────
  const { data: leaderRow } = await supabase
    .from('ministry_leaders')
    .select('user_id')
    .eq('ministry_id', id)
    .single()

  let leaderEmail: string | null = null
  if (leaderRow) {
    const { data: { user: lu } } = await sbAdmin.auth.admin.getUserById(leaderRow.user_id)
    leaderEmail = lu?.email ?? null
  }

  // ── Transferências ───────────────────────────────────────────────────────────
  type TransferRow = {
    id: string; person_id: string; from_ministry_id: string; to_ministry_id: string
    reason: string | null; status: string; created_at: string
    dest_notes: string | null; dh_notes: string | null
  }
  const { data: transfersRaw } = await sbAdmin.from('ministry_transfers')
    .select('id, person_id, from_ministry_id, to_ministry_id, reason, status, created_at, dest_notes, dh_notes')
    .eq('organization_id', orgId)
    .or(`from_ministry_id.eq.${id},to_ministry_id.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(30)
  const transfers = (transfersRaw ?? []) as TransferRow[]

  const transferPersonIds = [...new Set(transfers.map(t => t.person_id))]
  const transferMinistryIds = [...new Set(transfers.flatMap(t => [t.from_ministry_id, t.to_ministry_id]))]
  let transferPersonMap = new Map<string, string>()
  let transferMinistryMap = new Map<string, string>()
  if (transferPersonIds.length > 0) {
    const { data: pData } = await sbAdmin.from('people').select('id, full_name').in('id', transferPersonIds)
    transferPersonMap = new Map((pData ?? []).map(p => [p.id, p.full_name]))
  }
  if (transferMinistryIds.length > 0) {
    const { data: mData } = await sbAdmin.from('ministries').select('id, name').in('id', transferMinistryIds)
    transferMinistryMap = new Map((mData ?? []).map(m => [m.id, m.name]))
  }

  let otherMinistries: Array<{ id: string; name: string }> = []
  if (isLiderMinisterio || isManagement) {
    const { data: mData } = await supabase.from('ministries')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .neq('id', id)
      .order('name')
    otherMinistries = mData ?? []
  }

  // ── Dados exclusivos do DH ───────────────────────────────────────────────────
  const activeMemberPersonIds = new Set(members.map(m => m.person_id))

  let availablePeople: Array<{ id: string; full_name: string }> = []
  let orgUsersForAssignment: Array<{ id: string; email: string }> = []
  type PendingRaw = {
    id: string; request_type: string; notes: string | null; created_at: string
    person_id: string | null
    people: { full_name: string } | null
    ministry_roles: { name: string } | null
  }
  let pendingRequests: PendingRaw[] = []

  if (isManagement) {
    const [
      { data: peopleData },
      { data: pendingData },
      { data: orgUsersData },
    ] = await Promise.all([
      supabase.from('people').select('id, full_name').eq('organization_id', orgId).order('full_name'),
      supabase.from('ministry_pending_requests')
        .select('id, request_type, notes, created_at, person_id, people(full_name), ministry_roles(name)')
        .eq('ministry_id', id).eq('status', 'pendente').order('created_at', { ascending: true }),
      supabase.from('organization_users').select('user_id').eq('organization_id', orgId).eq('active', true),
    ])

    availablePeople  = (peopleData ?? []).filter(p => !activeMemberPersonIds.has(p.id))
    pendingRequests  = (pendingData ?? []) as unknown as PendingRaw[]

    if (orgUsersData?.length) {
      const { data: { users: authUsers } } = await sbAdmin.auth.admin.listUsers({ perPage: 1000 })
      const orgUserSet = new Set(orgUsersData.map(u => u.user_id))
      orgUsersForAssignment = authUsers
        .filter(u => orgUserSet.has(u.id) && u.id !== (leaderRow?.user_id ?? ''))
        .map(u => ({ id: u.id, email: u.email ?? u.id }))
        .sort((a, b) => a.email.localeCompare(b.email))
    }
  }

  // ── Dados exclusivos do Líder ────────────────────────────────────────────────
  type OpenReqRaw = {
    id: string; request_type: string; notes: string | null
    created_at: string; status: string; person_id: string | null
    people: { full_name: string } | null
    ministry_roles: { name: string } | null
  }
  let myOpenRequests: OpenReqRaw[] = []
  let leaderPeopleList: Array<{ id: string; full_name: string }> = []

  if (isLiderMinisterio) {
    const [{ data: myReqData }, { data: pData }] = await Promise.all([
      supabase.from('ministry_pending_requests')
        .select('id, request_type, notes, created_at, status, person_id, people(full_name), ministry_roles(name)')
        .eq('ministry_id', id).eq('requested_by', user.id).eq('status', 'pendente')
        .order('created_at', { ascending: false }),
      supabase.from('people').select('id, full_name').eq('organization_id', orgId).order('full_name'),
    ])
    myOpenRequests   = (myReqData ?? []) as unknown as OpenReqRaw[]
    leaderPeopleList = (pData ?? []).filter(p => !activeMemberPersonIds.has(p.id))
  }

  // ── Server actions ───────────────────────────────────────────────────────────

  const handleUpdate = async (formData: FormData) => {
    'use server'
    await updateMinistry(ministry.id, {
      name:        (formData.get('name') as string).trim(),
      description: (formData.get('description') as string).trim() || null,
      active:      formData.get('active') === 'on',
    })
    redirect(`/${slug}/ministerios/${id}?msg=atualizado`)
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
    await assignLeader(orgId, id, userId)
    redirect(`/${slug}/ministerios/${id}?msg=lider_atribuido`)
  }

  const handleRemoveLeader = async () => {
    'use server'
    await removeLeader(id)
    redirect(`/${slug}/ministerios/${id}`)
  }

  const handleAddMember = async (formData: FormData) => {
    'use server'
    const personId = formData.get('person_id') as string
    if (!personId) return
    await addMember(id, personId, (formData.get('role_id') as string) || null)
    redirect(`/${slug}/ministerios/${id}`)
  }

  const handleRemoveMember = async (formData: FormData) => {
    'use server'
    await removeMember(formData.get('member_id') as string)
    redirect(`/${slug}/ministerios/${id}`)
  }

  const handleApprove = async (formData: FormData) => {
    'use server'
    await approveRequest(formData.get('request_id') as string)
    redirect(`/${slug}/ministerios/${id}`)
  }

  const handleReject = async (formData: FormData) => {
    'use server'
    await rejectRequest(formData.get('request_id') as string)
    redirect(`/${slug}/ministerios/${id}`)
  }

  const handleRequestAdd = async (formData: FormData) => {
    'use server'
    const personId = formData.get('person_id') as string
    if (!personId) return
    await submitMemberRequest(
      orgId, id, user.id, 'add_member',
      personId, (formData.get('role_id') as string) || null,
      (formData.get('notes') as string) || null,
    )
    redirect(`/${slug}/ministerios/${id}?msg=enviada`)
  }

  const handleRequestRemove = async (formData: FormData) => {
    'use server'
    const personId = formData.get('person_id') as string
    if (!personId) return
    await submitMemberRequest(
      orgId, id, user.id, 'remove_member',
      personId, null, (formData.get('notes') as string) || null,
    )
    redirect(`/${slug}/ministerios/${id}?msg=enviada`)
  }

  const handleCancelRequest = async (formData: FormData) => {
    'use server'
    await cancelRequest(formData.get('request_id') as string)
    redirect(`/${slug}/ministerios/${id}`)
  }

  const handleServiceRequest = async (formData: FormData) => {
    'use server'
    const subject = (formData.get('subject') as string).trim()
    if (!subject) return
    await createServiceRequest(
      orgId, user.id, role,
      formData.get('target_department') as string,
      formData.get('request_type') as string,
      subject,
      (formData.get('description') as string) || null,
    )
    redirect(`/${slug}/ministerios/${id}?msg=servico_enviado`)
  }

  // ── Transfer actions ─────────────────────────────────────────────────────────
  const handleRequestTransfer = async (formData: FormData) => {
    'use server'
    const personId = formData.get('person_id') as string
    const toMinistryId = formData.get('to_ministry_id') as string
    const reason = (formData.get('reason') as string)?.trim() || null
    if (!personId || !toMinistryId) return
    await requestTransfer({ organizationId: orgId, personId, fromMinistryId: id, toMinistryId, requestedBy: user.id, reason })
    redirect(`/${slug}/ministerios/${id}?msg=transfer_enviada`)
  }

  const handleRespondTransfer = async (formData: FormData) => {
    'use server'
    const transferId = formData.get('transfer_id') as string
    const accept = formData.get('accept') === 'true'
    const notes = (formData.get('notes') as string)?.trim() || null
    await respondTransferAsDestination(transferId, user.id, accept, notes)
    redirect(`/${slug}/ministerios/${id}?msg=${accept ? 'transfer_aceita' : 'transfer_rejeitada'}`)
  }

  const handleConfirmTransfer = async (formData: FormData) => {
    'use server'
    const transferId = formData.get('transfer_id') as string
    const confirm = formData.get('confirm') === 'true'
    const notes = (formData.get('notes') as string)?.trim() || null
    await confirmTransferAsDH(transferId, user.id, confirm, notes)
    redirect(`/${slug}/ministerios/${id}?msg=${confirm ? 'transfer_efetivada' : 'transfer_rejeitada_dh'}`)
  }

  const handleCancelTransfer = async (formData: FormData) => {
    'use server'
    await cancelTransfer(formData.get('transfer_id') as string, user.id)
    redirect(`/${slug}/ministerios/${id}`)
  }

  // ── Mensagens de feedback ────────────────────────────────────────────────────
  const msgs: Record<string, { text: string; cls: string }> = {
    criado:          { text: 'Ministério criado com sucesso.', cls: 'bg-green-50 border-green-200 text-green-700' },
    atualizado:      { text: 'Informações atualizadas.',       cls: 'bg-green-50 border-green-200 text-green-700' },
    lider_atribuido: { text: 'Líder atribuído com sucesso.',   cls: 'bg-green-50 border-green-200 text-green-700' },
    enviada:         { text: 'Solicitação enviada. O DH será notificado.',  cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    servico_enviado:      { text: 'Solicitação de serviço enviada.', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    transfer_enviada:     { text: 'Transferência solicitada. O líder do ministério destino será notificado.', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    transfer_aceita:      { text: 'Transferência aceita. O DH confirmará a efetivação.', cls: 'bg-green-50 border-green-200 text-green-700' },
    transfer_rejeitada:   { text: 'Transferência recusada.', cls: 'bg-red-50 border-red-200 text-red-700' },
    transfer_efetivada:   { text: 'Transferência efetivada com sucesso.', cls: 'bg-green-50 border-green-200 text-green-700' },
    transfer_rejeitada_dh: { text: 'Transferência recusada pelo DH.', cls: 'bg-red-50 border-red-200 text-red-700' },
  }
  const msgInfo = msg ? msgs[msg] : null

  // ── Componentes auxiliares ───────────────────────────────────────────────────
  const Input = ({ name, label, defaultValue = '', required = false, placeholder = '' }: {
    name: string; label?: string; defaultValue?: string; required?: boolean; placeholder?: string
  }) => (
    <div>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}
      <input
        name={name} defaultValue={defaultValue} required={required} placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  )

  const Btn = ({ label, cls = 'bg-brand-500 hover:bg-brand-600 text-white' }: { label: string; cls?: string }) => (
    <button type="submit" className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${cls}`}>
      {label}
    </button>
  )

  return (
    <>
      <Header
        title={ministry.name}
        actions={
          <Link href={`/${slug}/ministerios`} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← Voltar
          </Link>
        }
      />
      <main className="p-4 md:p-6 space-y-4 max-w-5xl">
        {msgInfo && (
          <div className={`border rounded-lg px-4 py-3 text-sm ${msgInfo.cls}`}>
            {msgInfo.text}
          </div>
        )}

        {/* ════════ VISÃO DH ════════════════════════════════════════════════════ */}
        {isManagement && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-stagger">

            {/* Coluna principal */}
            <div className="lg:col-span-2 space-y-4">

              {/* Informações */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Informações</h2>
                <form action={handleUpdate} className="space-y-3">
                  <Input name="name" label="Nome" defaultValue={ministry.name} required />
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
                    <textarea
                      name="description" rows={2} defaultValue={ministry.description ?? ''}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox" name="active" defaultChecked={ministry.active}
                      className="rounded border-gray-300 text-brand-500"
                    />
                    <span className="text-sm text-gray-700">Ministério ativo</span>
                  </label>
                  <Btn label="Salvar alterações" />
                </form>
              </div>

              {/* Membros */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Membros ({members.length})
                </h2>
                {members.length > 0 ? (
                  <ul className="divide-y divide-gray-100 mb-3">
                    {members.map(m => (
                      <li key={m.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {m.people?.full_name ?? '—'}
                          </span>
                          {m.ministry_roles && (
                            <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {m.ministry_roles.name}
                            </span>
                          )}
                        </div>
                        <form action={handleRemoveMember} className="flex-shrink-0">
                          <input type="hidden" name="member_id" value={m.id} />
                          <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                            Remover
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 mb-3">Nenhum membro ainda.</p>
                )}
                {availablePeople.length > 0 && (
                  <details className={members.length > 0 ? 'border-t border-gray-100 pt-3' : ''}>
                    <summary className="text-sm text-brand-600 cursor-pointer select-none font-medium">
                      + Adicionar membro
                    </summary>
                    <form action={handleAddMember} className="mt-3 flex flex-wrap gap-2">
                      <select
                        name="person_id" required
                        className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      >
                        <option value="">Selecionar pessoa...</option>
                        {availablePeople.map(p => (
                          <option key={p.id} value={p.id}>{p.full_name}</option>
                        ))}
                      </select>
                      {ministryRoles.length > 0 && (
                        <select
                          name="role_id"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                        >
                          <option value="">Sem papel</option>
                          {ministryRoles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      )}
                      <Btn label="Adicionar" />
                    </form>
                  </details>
                )}
              </div>
            </div>

            {/* Coluna lateral */}
            <div className="space-y-4">

              {/* Líder */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Líder do Ministério</h2>
                {leaderEmail ? (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-900">{leaderEmail}</p>
                    <form action={handleRemoveLeader} className="mt-1">
                      <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                        Remover líder
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 mb-3">Sem líder atribuído.</p>
                )}
                {orgUsersForAssignment.length > 0 ? (
                  <details className={leaderEmail ? 'border-t border-gray-100 pt-3' : ''}>
                    <summary className="text-sm text-brand-600 cursor-pointer select-none font-medium">
                      {leaderEmail ? 'Trocar líder' : 'Atribuir líder'}
                    </summary>
                    <form action={handleAssignLeader} className="mt-3 space-y-2">
                      <select
                        name="user_id" required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      >
                        <option value="">Selecionar usuário...</option>
                        {orgUsersForAssignment.map(u => (
                          <option key={u.id} value={u.id}>{u.email}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400">O papel do usuário será atualizado para Líder de Ministério.</p>
                      <Btn label="Confirmar" cls="w-full bg-brand-500 hover:bg-brand-600 text-white" />
                    </form>
                  </details>
                ) : (
                  <p className="text-xs text-gray-400">Nenhum outro usuário disponível na organização.</p>
                )}
              </div>

              {/* Transferências para confirmar (DH) */}
              {(() => {
                const dhTransfers = transfers.filter(t => t.status === 'aceito_destino')
                if (dhTransfers.length === 0) return null
                return (
                  <div className="bg-white rounded-xl border border-amber-200 p-5">
                    <h2 className="text-sm font-semibold text-amber-700 mb-3">
                      Transferências p/ Confirmar
                      <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                        {dhTransfers.length}
                      </span>
                    </h2>
                    <ul className="space-y-3">
                      {dhTransfers.map(t => (
                        <li key={t.id} className="border border-amber-100 rounded-lg p-3 space-y-2">
                          <p className="text-sm font-medium text-gray-800">
                            {transferPersonMap.get(t.person_id) ?? '—'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {transferMinistryMap.get(t.from_ministry_id) ?? '?'} → {transferMinistryMap.get(t.to_ministry_id) ?? '?'}
                          </p>
                          {t.reason && <p className="text-xs text-gray-400 italic">&ldquo;{t.reason}&rdquo;</p>}
                          {t.dest_notes && <p className="text-xs text-green-600">Líder destino: &ldquo;{t.dest_notes}&rdquo;</p>}
                          <form action={handleConfirmTransfer} className="flex gap-2 pt-1">
                            <input type="hidden" name="transfer_id" value={t.id} />
                            <input name="notes" placeholder="Observação (opcional)" className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400" />
                            <button type="submit" name="confirm" value="true" className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors">
                              Efetivar
                            </button>
                            <button type="submit" name="confirm" value="false" className="px-3 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors">
                              Recusar
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}

              {/* Solicitações pendentes do líder */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Solicitações do Líder
                  {pendingRequests.length > 0 && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                      {pendingRequests.length}
                    </span>
                  )}
                </h2>
                {pendingRequests.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma solicitação pendente.</p>
                ) : (
                  <ul className="space-y-3">
                    {pendingRequests.map(req => {
                      const pName = (req.people as { full_name: string } | null)?.full_name
                      const rName = (req.ministry_roles as { name: string } | null)?.name
                      return (
                        <li key={req.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between gap-2 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800">
                                {REQUEST_LABELS[req.request_type] ?? req.request_type}
                              </p>
                              {pName && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {pName}{rName ? ` → ${rName}` : ''}
                                </p>
                              )}
                              {req.notes && (
                                <p className="text-xs text-gray-400 italic mt-0.5">&ldquo;{req.notes}&rdquo;</p>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                              {daysAgo(req.created_at)}d
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <form action={handleApprove}>
                              <input type="hidden" name="request_id" value={req.id} />
                              <button type="submit" className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors">
                                Aprovar
                              </button>
                            </form>
                            <form action={handleReject}>
                              <input type="hidden" name="request_id" value={req.id} />
                              <button type="submit" className="px-3 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors">
                                Rejeitar
                              </button>
                            </form>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════ VISÃO LÍDER DE MINISTÉRIO ═══════════════════════════════════ */}
        {isLiderMinisterio && (
          <div className="space-y-4 max-w-2xl">

            {/* Info read-only */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">{ministry.name}</h2>
                {ministry.description && (
                  <p className="text-sm text-gray-500 mt-1">{ministry.description}</p>
                )}
              </div>
              <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${ministry.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {ministry.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            {/* Transferências recebidas (líder destino precisa aceitar) */}
            {(() => {
              const incoming = transfers.filter(t => t.to_ministry_id === id && t.status === 'pendente_destino')
              if (incoming.length === 0) return null
              return (
                <div className="bg-white rounded-xl border border-amber-200 p-5">
                  <h2 className="text-sm font-semibold text-amber-700 mb-3">
                    Transferências Recebidas
                    <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{incoming.length}</span>
                  </h2>
                  <ul className="space-y-3">
                    {incoming.map(t => (
                      <li key={t.id} className="border border-amber-100 rounded-lg p-3 space-y-2">
                        <p className="text-sm font-medium text-gray-800">
                          {transferPersonMap.get(t.person_id) ?? '—'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Vindo de: {transferMinistryMap.get(t.from_ministry_id) ?? '?'}
                        </p>
                        {t.reason && <p className="text-xs text-gray-400 italic">&ldquo;{t.reason}&rdquo;</p>}
                        <form action={handleRespondTransfer} className="flex gap-2 pt-1">
                          <input type="hidden" name="transfer_id" value={t.id} />
                          <input name="notes" placeholder="Observação (opcional)" className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400" />
                          <button type="submit" name="accept" value="true" className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors">
                            Aceitar
                          </button>
                          <button type="submit" name="accept" value="false" className="px-3 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors">
                            Recusar
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })()}

            {/* Membros + solicitar remoção/adição/transferência */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Membros ({members.length})</h2>
              {members.length > 0 ? (
                <ul className="divide-y divide-gray-100 mb-3">
                  {members.map(m => {
                    const hasPendingTransfer = transfers.some(t => t.person_id === m.person_id && ['pendente_destino', 'aceito_destino'].includes(t.status))
                    return (
                      <li key={m.id} className="py-2.5 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-900">{m.people?.full_name ?? '—'}</span>
                          {m.ministry_roles && (
                            <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {m.ministry_roles.name}
                            </span>
                          )}
                          {hasPendingTransfer && (
                            <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              Em transferência
                            </span>
                          )}
                        </div>
                        {!hasPendingTransfer && (
                          <div className="flex gap-2 flex-shrink-0">
                            {otherMinistries.length > 0 && (
                              <details className="text-right">
                                <summary className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer select-none">
                                  Transferir
                                </summary>
                                <form action={handleRequestTransfer} className="mt-1.5 space-y-1">
                                  <input type="hidden" name="person_id" value={m.person_id} />
                                  <select name="to_ministry_id" required className="w-44 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400">
                                    <option value="">Para qual ministério?</option>
                                    {otherMinistries.map(om => (
                                      <option key={om.id} value={om.id}>{om.name}</option>
                                    ))}
                                  </select>
                                  <input name="reason" placeholder="Motivo (opcional)" className="w-44 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400" />
                                  <button type="submit" className="w-44 px-2 py-1 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium rounded hover:bg-blue-100 transition-colors">
                                    Solicitar transferência
                                  </button>
                                </form>
                              </details>
                            )}
                            <details className="text-right">
                              <summary className="text-xs text-red-400 hover:text-red-600 cursor-pointer select-none">
                                Remover
                              </summary>
                              <form action={handleRequestRemove} className="mt-1.5 space-y-1">
                                <input type="hidden" name="person_id" value={m.person_id} />
                                <input name="notes" placeholder="Motivo (opcional)" className="w-44 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400" />
                                <button type="submit" className="w-44 px-2 py-1 bg-red-50 border border-red-200 text-red-600 text-xs font-medium rounded hover:bg-red-100 transition-colors">
                                  Enviar solicitação
                                </button>
                              </form>
                            </details>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 mb-3">Nenhum membro ainda.</p>
              )}

              {leaderPeopleList.length > 0 && (
                <details className={members.length > 0 ? 'border-t border-gray-100 pt-3' : ''}>
                  <summary className="text-sm text-brand-600 cursor-pointer select-none font-medium">
                    + Solicitar adição de membro
                  </summary>
                  <form action={handleRequestAdd} className="mt-3 space-y-2">
                    <select
                      name="person_id" required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    >
                      <option value="">Selecionar pessoa...</option>
                      {leaderPeopleList.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                    {ministryRoles.length > 0 && (
                      <select
                        name="role_id"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      >
                        <option value="">Sem papel específico</option>
                        {ministryRoles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    )}
                    <input
                      name="notes" placeholder="Observação (opcional)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    <Btn label="Enviar Solicitação" cls="w-full bg-brand-500 hover:bg-brand-600 text-white" />
                  </form>
                </details>
              )}
            </div>

            {/* Minhas solicitações abertas */}
            {myOpenRequests.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Minhas Solicitações em Aberto ({myOpenRequests.length})
                </h2>
                <ul className="divide-y divide-gray-100">
                  {myOpenRequests.map(req => {
                    const pName = (req.people as { full_name: string } | null)?.full_name
                    const rName = (req.ministry_roles as { name: string } | null)?.name
                    return (
                      <li key={req.id} className="py-2.5 flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">{REQUEST_LABELS[req.request_type] ?? req.request_type}</span>
                          {pName && ` — ${pName}`}
                          {rName && ` → ${rName}`}
                          {req.notes && <span className="text-gray-400 italic text-xs ml-1">&ldquo;{req.notes}&rdquo;</span>}
                        </p>
                        <form action={handleCancelRequest} className="flex-shrink-0">
                          <input type="hidden" name="request_id" value={req.id} />
                          <button type="submit" className="text-xs text-gray-400 hover:text-gray-700 transition-colors whitespace-nowrap">
                            Cancelar
                          </button>
                        </form>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Transferências enviadas (líder vê status) */}
            {(() => {
              const sent = transfers.filter(t => t.from_ministry_id === id && !['cancelado'].includes(t.status))
              if (sent.length === 0) return null
              const STATUS_T: Record<string, { label: string; cls: string }> = {
                pendente_destino:  { label: 'Aguardando destino', cls: 'bg-yellow-100 text-yellow-700' },
                aceito_destino:    { label: 'Aceito, aguarda DH', cls: 'bg-blue-100 text-blue-700' },
                rejeitado_destino: { label: 'Recusado pelo destino', cls: 'bg-red-100 text-red-600' },
                rejeitado_dh:      { label: 'Recusado pelo DH', cls: 'bg-red-100 text-red-600' },
                efetivado:         { label: 'Efetivado', cls: 'bg-green-100 text-green-700' },
              }
              return (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">Transferências Enviadas</h2>
                  <ul className="space-y-2">
                    {sent.map(t => {
                      const st = STATUS_T[t.status] ?? { label: t.status, cls: 'bg-gray-100 text-gray-600' }
                      const canCancel = ['pendente_destino', 'aceito_destino'].includes(t.status)
                      return (
                        <li key={t.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {transferPersonMap.get(t.person_id) ?? '—'} → {transferMinistryMap.get(t.to_ministry_id) ?? '?'}
                            </p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                          </div>
                          {canCancel && (
                            <form action={handleCancelTransfer} className="flex-shrink-0">
                              <input type="hidden" name="transfer_id" value={t.id} />
                              <button type="submit" className="text-xs text-gray-400 hover:text-red-500 transition-colors">Cancelar</button>
                            </form>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })()}

            {/* Reservas */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Reservas</h2>
              <p className="text-xs text-gray-400 mb-3">
                Solicite espaços para atividades do ministério ou quartos para convidados.
              </p>
              <Link href={`/${slug}/reservas`}
                className="block text-center w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
                Solicitar / Ver Reservas →
              </Link>
            </div>

            {/* Solicitar Serviço */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Nova Solicitação de Serviço</h2>
              <p className="text-xs text-gray-400 mb-3">
                Para outros departamentos da base (hospitalidade, DH, secretaria, etc.)
              </p>
              <form action={handleServiceRequest} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Destino</label>
                    <select name="target_department" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                      <option value="hospitalidade">Hospitalidade</option>
                      <option value="dh">DH</option>
                      <option value="secretaria">Secretaria</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                    <select name="request_type" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                      <option value="convidar_professor">Convidar professor</option>
                      <option value="hospedagem">Hospedagem</option>
                      <option value="logistica">Logística</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                </div>
                <Input name="subject" label="Assunto" required placeholder="Resumo da solicitação..." />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
                  <textarea
                    name="description" rows={3} placeholder="Detalhes..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  />
                </div>
                <Btn label="Enviar Solicitação" cls="w-full bg-brand-500 hover:bg-brand-600 text-white" />
              </form>
            </div>
          </div>
        )}

        {/* ════════ VISÃO OBREIRO DE MINISTÉRIO ════════════════════════════════ */}
        {isObreiroMinisterio && (
          <div className="space-y-4 max-w-2xl">
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">{ministry.name}</h2>
                {ministry.description && (
                  <p className="text-sm text-gray-500 mt-1">{ministry.description}</p>
                )}
              </div>
              <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${ministry.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {ministry.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Membros ({members.length})</h2>
              {members.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {members.map(m => (
                    <li key={m.id} className="py-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-gray-900">{m.people?.full_name ?? '—'}</span>
                        {m.ministry_roles && (
                          <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {m.ministry_roles.name}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Nenhum membro ainda.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  )
}
