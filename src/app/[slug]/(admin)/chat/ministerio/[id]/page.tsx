import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isManagementRole, isOperationalManager } from '@/lib/auth/permissions'
import { getOrgAndUser, getWorkspaceRole, getWorkspaceMinistry, getWorkspaceMinistryLink } from '../../../ministerios/[id]/_data'
import { MuralClient } from '../../../ministerios/[id]/mural/MuralClient'
import { GroupChatHeader } from '../../GroupChatHeader'

type Props = { params: Promise<{ slug: string; id: string }> }

// Grupo do ministério dentro do Chat unificado — mesmo MuralClient que já
// existia na antiga aba "Chat" do workspace do ministério, só realocado
// (sem migrar dado: continua lendo/escrevendo em ministry_messages).
export default async function MinistryGroupChatPage({ params }: Props) {
  const { slug, id } = await params
  const sbAdmin = createAdminClient()

  const { user, orgId } = await getOrgAndUser(slug)
  if (!user || !orgId) notFound()

  const ministry = await getWorkspaceMinistry(orgId, id)
  if (!ministry) notFound()

  const { role, preview } = await getWorkspaceRole(user.id, orgId)
  const isManagement = isManagementRole(role)
  const canWrite = isOperationalManager(role)
    || (await getWorkspaceMinistryLink(user.id, orgId, role, preview, id)) === 'lider'
  if (!isManagement && !canWrite) {
    const link = await getWorkspaceMinistryLink(user.id, orgId, role, preview, id)
    if (!link) notFound()
  }

  const { data: profile } = await sbAdmin
    .from('staff_profiles')
    .select('person_id, people(full_name)')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()
  const authorName = (profile?.people as unknown as { full_name: string } | null)?.full_name ?? user.email ?? 'Anônimo'

  const [{ data: messagesRaw }, { data: membersRaw }] = await Promise.all([
    sbAdmin.from('ministry_messages')
      .select('id, author_name, author_id, content, mentions, color, font, text_color, font_size, created_at, edited_at')
      .eq('ministry_id', id)
      .order('created_at', { ascending: true })
      .limit(30),
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
    font_size: (m as unknown as { font_size: number }).font_size ?? 1,
  }))

  const members = (membersRaw ?? []).map(m => ({
    person_id: m.person_id,
    name: (m.people as unknown as { full_name: string } | null)?.full_name ?? '—',
  }))

  let nextColor = 0
  if (messages.length > 0) nextColor = (messages[messages.length - 1].color + 1) % 6

  await sbAdmin.from('ministry_message_reads').upsert(
    { user_id: user.id, ministry_id: id, last_read_at: new Date().toISOString() },
    { onConflict: 'user_id,ministry_id' },
  )

  async function postMessage(formData: FormData) {
    'use server'
    if (!user) return
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
      author_name: authorName, content, mentions: mentionedIds,
      color: Number(formData.get('color') ?? nextColor),
      font: Number(formData.get('font') ?? 0),
      text_color: Number(formData.get('text_color') ?? 0),
      font_size: Number(formData.get('font_size') ?? 1),
    })
    const { data: excess } = await db.from('ministry_messages')
      .select('id').eq('ministry_id', id)
      .order('created_at', { ascending: false })
      .range(30, 999)
    if (excess?.length) await db.from('ministry_messages').delete().in('id', excess.map(e => e.id))
  }

  async function deleteMessage(formData: FormData) {
    'use server'
    const messageId = formData.get('message_id') as string
    if (!messageId) return
    const db = createAdminClient()
    await db.from('ministry_messages').delete().eq('id', messageId).eq('ministry_id', id)
  }

  async function editMessage(formData: FormData) {
    'use server'
    const messageId = formData.get('message_id') as string
    const content = (formData.get('content') as string)?.trim()
    if (!messageId || !content || !user) return
    const db = createAdminClient()
    await db.from('ministry_messages')
      .update({ content, edited_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('ministry_id', id)
      .eq('author_id', user.id)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <GroupChatHeader slug={slug} name={ministry.name} />
      <MuralClient
        messages={messages}
        members={members}
        currentUserId={user.id}
        currentUserName={authorName}
        canDelete={canWrite || isManagement}
        nextColor={nextColor}
        postAction={postMessage}
        deleteAction={deleteMessage}
        editAction={editMessage}
      />
    </div>
  )
}
