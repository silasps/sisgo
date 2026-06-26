import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isManagementRole, isOperationalManager } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { Users, BookOpen, ClipboardList } from 'lucide-react'
import { MuralClient } from '../../ministerios/[id]/mural/MuralClient'

type Props = {
  params: Promise<{ slug: string; id: string }>
}

export default async function EscolaOverviewPage({ params }: Props) {
  const { slug, id } = await params
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
  let canWrite = isOperationalManager(role)

  if (!canWrite && role === 'lider_eted') {
    const { data: leaderLink } = await supabase
      .from('school_leaders')
      .select('id')
      .eq('school_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (leaderLink) canWrite = true
  }

  const { data: escola } = await supabase
    .from('schools')
    .select('id, name, description, active, school_type')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!escola) notFound()

  const { data: profile } = await sbAdmin
    .from('staff_profiles')
    .select('person_id, people(full_name)')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()
  const authorName = (profile?.people as unknown as { full_name: string } | null)?.full_name ?? user.email ?? 'Anônimo'

  const [{ count: staffCount }, { count: classCount }, { count: pendingCount }, { data: messagesRaw }, { data: staffRaw }] = await Promise.all([
    supabase.from('school_staff').select('*', { count: 'exact', head: true }).eq('school_id', id).eq('active', true),
    supabase.from('school_classes').select('*', { count: 'exact', head: true }).eq('school_id', id).eq('active', true),
    supabase.from('school_pending_requests').select('*', { count: 'exact', head: true }).eq('school_id', id).eq('status', 'pendente'),
    sbAdmin.from('school_messages')
      .select('id, author_name, author_id, content, mentions, color, font, text_color, font_size, created_at')
      .eq('school_id', id)
      .order('created_at', { ascending: true })
      .limit(30),
    sbAdmin.from('school_staff')
      .select('person_id, people(full_name)')
      .eq('school_id', id)
      .eq('active', true),
  ])

  const messages = (messagesRaw ?? []).map(m => ({
    ...m,
    mentions: (m.mentions as string[] | null) ?? [],
    font: (m as unknown as { font: number }).font ?? 0,
    text_color: (m as unknown as { text_color: number }).text_color ?? 0,
    font_size: (m as unknown as { font_size: number }).font_size ?? 1,
  }))

  const members = (staffRaw ?? []).map(s => ({
    person_id: s.person_id,
    name: (s.people as unknown as { full_name: string } | null)?.full_name ?? '—',
  }))

  let nextColor = 0
  if (messages.length > 0) {
    nextColor = (messages[messages.length - 1].color + 1) % 6
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
    await db.from('school_messages').insert({
      organization_id: orgId, school_id: id, author_id: user.id,
      author_name: authorName, content, mentions: mentionedIds,
      color: nextColor,
      font: Number(formData.get('font') ?? 0),
      text_color: Number(formData.get('text_color') ?? 0),
      font_size: Number(formData.get('font_size') ?? 1),
    })
    const { data: excess } = await db.from('school_messages')
      .select('id').eq('school_id', id)
      .order('created_at', { ascending: false })
      .range(30, 999)
    if (excess?.length) {
      await db.from('school_messages').delete().in('id', excess.map(e => e.id))
    }
  }

  async function deleteMessage(formData: FormData) {
    'use server'
    const messageId = formData.get('message_id') as string
    if (!messageId) return
    const db = createAdminClient()
    await db.from('school_messages').delete().eq('id', messageId).eq('school_id', id)
  }

  const base = `/${slug}/escolas/${id}`

  return (
    <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
      {/* Sidebar — mobile: faixa horizontal no topo / desktop: coluna direita */}
      <aside className="order-first lg:order-last w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-l border-gray-200 bg-gray-50/50 overflow-y-auto p-3 lg:p-4 space-y-2 lg:space-y-3">
        {/* Stats */}
        <div className="flex lg:grid lg:grid-cols-3 gap-2">
          <Link href={`${base}/equipe`} className="flex-1 group bg-white rounded-xl border border-gray-200 p-2.5 lg:p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex lg:flex-col items-center gap-2 lg:gap-0 lg:text-center">
              <Users size={14} className="text-brand-600 lg:mb-1" />
              <div>
                <p className="text-base lg:text-lg font-bold text-gray-900 leading-none">{staffCount ?? 0}</p>
                <p className="text-[10px] text-gray-500">Obreiros</p>
              </div>
            </div>
          </Link>
          <Link href={`${base}/configuracoes`} className="flex-1 group bg-white rounded-xl border border-gray-200 p-2.5 lg:p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex lg:flex-col items-center gap-2 lg:gap-0 lg:text-center">
              <BookOpen size={14} className="text-indigo-600 lg:mb-1" />
              <div>
                <p className="text-base lg:text-lg font-bold text-gray-900 leading-none">{classCount ?? 0}</p>
                <p className="text-[10px] text-gray-500">Turmas</p>
              </div>
            </div>
          </Link>
          <Link href={`${base}/equipe`} className="flex-1 group bg-white rounded-xl border border-gray-200 p-2.5 lg:p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex lg:flex-col items-center gap-2 lg:gap-0 lg:text-center">
              <ClipboardList size={14} className="text-amber-600 lg:mb-1" />
              <div>
                <p className="text-base lg:text-lg font-bold text-gray-900 leading-none">{pendingCount ?? 0}</p>
                <p className="text-[10px] text-gray-500">Pendências</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Info — hidden on mobile */}
        <div className="hidden lg:block bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{escola.name}</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${escola.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {escola.active ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          {escola.description && <p className="text-xs text-gray-500 mt-1">{escola.description}</p>}
          {escola.school_type && (
            <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wide">{escola.school_type}</p>
          )}
        </div>
      </aside>

      {/* Coluna principal — Mural */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 order-last lg:order-first">
        <MuralClient
          messages={messages}
          members={members}
          currentUserId={user.id}
          currentUserName={authorName}
          canDelete={canWrite}
          nextColor={nextColor}
          postAction={postMessage}
          deleteAction={deleteMessage}
        />
      </div>
    </main>
  )
}
