import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { updateMinistry, assignLeader, removeLeader } from './actions'
import { isManagementRole, isOperationalManager } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { Users, ClipboardList } from 'lucide-react'
import { MuralClient } from './mural/MuralClient'

type Props = {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ msg?: string }>
}

export default async function MinisterioOverviewPage({ params, searchParams }: Props) {
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

  const { data: ministry } = await supabase
    .from('ministries')
    .select('id, name, description, active')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!ministry) notFound()

  // ── Data ──────────────────────────────────────────────────────────────────────
  const { data: profile } = await sbAdmin
    .from('staff_profiles')
    .select('person_id, people(full_name)')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()
  const authorName = (profile?.people as unknown as { full_name: string } | null)?.full_name ?? user.email ?? 'Anônimo'

  const [{ count: memberCount }, { count: pendingCount }, { data: messagesRaw }, { data: membersRaw }] = await Promise.all([
    supabase.from('ministry_members').select('*', { count: 'exact', head: true }).eq('ministry_id', id).eq('active', true),
    supabase.from('ministry_pending_requests').select('*', { count: 'exact', head: true }).eq('ministry_id', id).eq('status', 'pendente'),
    sbAdmin.from('ministry_messages')
      .select('id, author_name, author_id, content, mentions, color, font, text_color, created_at')
      .eq('ministry_id', id)
      .order('created_at', { ascending: true })
      .limit(200),
    sbAdmin.from('ministry_members')
      .select('person_id, people(full_name)')
      .eq('ministry_id', id)
      .eq('active', true),
  ])

  const messages = (messagesRaw ?? []).map(m => ({
    ...m,
    mentions: (m.mentions as string[] | null) ?? [],
    font: (m as unknown as { font: number }).font ?? 0,
    text_color: (m as unknown as { text_color: number }).text_color ?? 0,
  }))

  const members = (membersRaw ?? []).map(m => ({
    person_id: m.person_id,
    name: (m.people as unknown as { full_name: string } | null)?.full_name ?? '—',
  }))

  let nextColor = 0
  if (messages.length > 0) {
    nextColor = (messages[messages.length - 1].color + 1) % 6
  }

  let leaderEmail: string | null = null
  let orgUsersForAssignment: Array<{ id: string; email: string }> = []
  let leaderUserId: string | null = null

  if (isManagement) {
    const { data: leaderRow } = await supabase
      .from('ministry_leaders')
      .select('user_id')
      .eq('ministry_id', id)
      .single()
    leaderUserId = leaderRow?.user_id ?? null

    if (leaderRow) {
      const { data: { user: lu } } = await sbAdmin.auth.admin.getUserById(leaderRow.user_id)
      leaderEmail = lu?.email ?? null
    }

    const { data: orgUsersData } = await supabase
      .from('organization_users')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('active', true)

    if (orgUsersData?.length) {
      const { data: { users: authUsers } } = await sbAdmin.auth.admin.listUsers({ perPage: 1000 })
      const orgUserSet = new Set(orgUsersData.map(u => u.user_id))
      orgUsersForAssignment = authUsers
        .filter(u => orgUserSet.has(u.id) && u.id !== (leaderUserId ?? ''))
        .map(u => ({ id: u.id, email: u.email ?? u.id }))
        .sort((a, b) => a.email.localeCompare(b.email))
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────────
  const handleUpdate = async (formData: FormData) => {
    'use server'
    await updateMinistry(ministry.id, {
      name: (formData.get('name') as string).trim(),
      description: (formData.get('description') as string).trim() || null,
      active: formData.get('active') === 'on',
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

  async function postMessage(formData: FormData) {
    'use server'
    const content = (formData.get('content') as string).trim()
    if (!content) return
    const mentionMatches = content.match(/@[\w\s]+/g) ?? []
    const mentionedIds: string[] = []
    for (const match of mentionMatches) {
      const name = match.slice(1).trim().toLowerCase()
      const member = members.find(m => m.name.toLowerCase().startsWith(name))
      if (member) mentionedIds.push(member.person_id)
    }
    const db = createAdminClient()
    await db.from('ministry_messages').insert({
      organization_id: orgId, ministry_id: id, author_id: user.id,
      author_name: authorName, content, mentions: mentionedIds, color: nextColor,
      font: Number(formData.get('font') ?? 0),
      text_color: Number(formData.get('text_color') ?? 0),
    })
    redirect(`/${slug}/ministerios/${id}`)
  }

  async function deleteMessage(formData: FormData) {
    'use server'
    const messageId = formData.get('message_id') as string
    if (!messageId) return
    const db = createAdminClient()
    await db.from('ministry_messages').delete().eq('id', messageId).eq('ministry_id', id)
    redirect(`/${slug}/ministerios/${id}`)
  }

  const msgs: Record<string, { text: string; cls: string }> = {
    criado:           { text: 'Ministério criado com sucesso.', cls: 'bg-green-50 border-green-200 text-green-700' },
    atualizado:       { text: 'Informações atualizadas.', cls: 'bg-green-50 border-green-200 text-green-700' },
    lider_atribuido:  { text: 'Líder atribuído com sucesso.', cls: 'bg-green-50 border-green-200 text-green-700' },
  }
  const msgInfo = msg ? msgs[msg] : null
  const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
  const base = `/${slug}/ministerios/${id}`

  return (
    <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
      {/* Coluna principal — Mural */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {msgInfo && (
          <div className={`border rounded-lg px-4 py-3 text-sm mx-4 mt-4 md:mx-6 md:mt-6 ${msgInfo.cls}`}>
            {msgInfo.text}
          </div>
        )}
        <MuralClient
          messages={messages}
          members={members}
          currentUserId={user.id}
          canDelete={canWrite}
          postAction={postMessage}
          deleteAction={deleteMessage}
        />
      </div>

      {/* Sidebar direita — stats + info + líder */}
      <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50/50 overflow-y-auto p-4 space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <Link href={`${base}/equipe`} className="group bg-white rounded-xl border border-gray-200 p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-brand-50 p-1.5"><Users size={14} className="text-brand-600" /></div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{memberCount ?? 0}</p>
                <p className="text-[10px] text-gray-500">Membros</p>
              </div>
            </div>
          </Link>
          <Link href={`${base}/equipe`} className="group bg-white rounded-xl border border-gray-200 p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-50 p-1.5"><ClipboardList size={14} className="text-amber-600" /></div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{pendingCount ?? 0}</p>
                <p className="text-[10px] text-gray-500">Pendências</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {canWrite ? (
            <>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Informações</h3>
              <form action={handleUpdate} className="space-y-2">
                <input name="name" defaultValue={ministry.name} required className={`${INPUT} text-xs`} />
                <textarea name="description" rows={2} defaultValue={ministry.description ?? ''} placeholder="Descrição..." className={`${INPUT} text-xs resize-none`} />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="active" defaultChecked={ministry.active} className="rounded border-gray-300 text-brand-500 h-3.5 w-3.5" />
                  <span className="text-xs text-gray-600">Ativo</span>
                </label>
                <button type="submit" className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors">
                  Salvar
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{ministry.name}</h3>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ministry.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {ministry.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {ministry.description && <p className="text-xs text-gray-500 mt-1">{ministry.description}</p>}
            </>
          )}
        </div>

        {/* Líder */}
        {isManagement && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
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
        )}
      </aside>
    </main>
  )
}
