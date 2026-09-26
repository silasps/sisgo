import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { getMyMinistries, getMySchools } from '@/lib/auth/unit-access'
import { ChatShell } from './ChatShell'
import { ConversationList } from './ConversationList'
import { resolveNames } from './_data'
import type { ChatListItem, ConversationSummary, GroupSummary } from './types'

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode }

export default async function ChatLayout({ params, children }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const db = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) redirect('/login')

  const { role, preview } = await getCurrentOrganizationRole(supabase, user.id, org.id)

  const [conversations, groups] = await Promise.all([
    loadConversations(db, org.id, user.id),
    loadGroups(db, org.id, user.id, role, preview),
  ])
  const items: ChatListItem[] = [...conversations, ...groups]
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))

  const chatBasePath = `/${slug}/chat`

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Header title="Chat" />
      <ChatShell
        chatBasePath={chatBasePath}
        list={<ConversationList items={items} chatBasePath={chatBasePath} orgId={org.id} />}
      >
        {children}
      </ChatShell>
    </div>
  )
}

type Admin = ReturnType<typeof createAdminClient>

async function loadConversations(db: Admin, orgId: string, userId: string): Promise<ConversationSummary[]> {
  const { data: myParts } = await db.from('chat_participants').select('conversation_id, last_read_at').eq('user_id', userId)
  const conversationIds = (myParts ?? []).map(p => p.conversation_id)
  if (conversationIds.length === 0) return []
  const lastReadByConvo = new Map((myParts ?? []).map(p => [p.conversation_id, p.last_read_at]))

  const [{ data: otherParts }, { data: convos }, { data: recentMessages }] = await Promise.all([
    db.from('chat_participants').select('conversation_id, user_id').in('conversation_id', conversationIds).neq('user_id', userId),
    db.from('chat_conversations').select('id, last_message_at').in('id', conversationIds),
    db.from('chat_messages')
      .select('conversation_id, content, created_at, author_id')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const otherUserIdByConvo = new Map((otherParts ?? []).map(p => [p.conversation_id, p.user_id]))
  const otherUserIds = [...new Set(otherUserIdByConvo.values())]

  const nameByUserId = await resolveNames(db, orgId, otherUserIds)

  const lastMessageByConvo = new Map<string, { content: string; created_at: string; author_id: string }>()
  for (const m of recentMessages ?? []) {
    if (!lastMessageByConvo.has(m.conversation_id)) lastMessageByConvo.set(m.conversation_id, m)
  }

  const lastMessageAtByConvo = new Map((convos ?? []).map(c => [c.id, c.last_message_at]))

  return conversationIds.map((id): ConversationSummary => {
    const otherUserId = otherUserIdByConvo.get(id) ?? ''
    const last = lastMessageByConvo.get(id)
    const lastReadAt = lastReadByConvo.get(id)
    const unread = !!last && last.author_id !== userId && (!lastReadAt || new Date(last.created_at) > new Date(lastReadAt))
    return {
      type: 'dm',
      id,
      otherUserId,
      otherName: nameByUserId.get(otherUserId) ?? 'Pessoa',
      lastMessagePreview: last ? last.content : null,
      lastMessageAt: lastMessageAtByConvo.get(id) ?? null,
      unread,
    }
  })
}

// Ministérios/escolas que a pessoa tem vínculo viram "grupos" na mesma
// lista — mesmas consultas que o antigo badge de nav já usava
// (unread = mensagem de outra pessoa depois do próprio last_read_at).
async function loadGroups(
  db: Admin, orgId: string, userId: string, role: string, preview: Awaited<ReturnType<typeof getCurrentOrganizationRole>>['preview'],
): Promise<GroupSummary[]> {
  const ctx = { userId, orgId, role, preview }
  const [ministries, schools] = await Promise.all([getMyMinistries(ctx), getMySchools(ctx)])

  const ministryIds = ministries.map(m => m.id)
  const schoolIds = schools.map(s => s.id)

  const [
    { data: ministryReads }, { data: ministryMsgs },
    { data: schoolReads }, { data: schoolMsgs },
  ] = await Promise.all([
    ministryIds.length > 0
      ? db.from('ministry_message_reads').select('ministry_id, last_read_at').eq('user_id', userId).in('ministry_id', ministryIds)
      : Promise.resolve({ data: [] }),
    ministryIds.length > 0
      ? db.from('ministry_messages').select('ministry_id, content, created_at, author_id').in('ministry_id', ministryIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    schoolIds.length > 0
      ? db.from('school_message_reads').select('school_id, last_read_at').eq('user_id', userId).in('school_id', schoolIds)
      : Promise.resolve({ data: [] }),
    schoolIds.length > 0
      ? db.from('school_messages').select('school_id, content, created_at, author_id').in('school_id', schoolIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const buildGroup = (
    id: string, kind: 'ministerio' | 'escola', name: string,
    lastReadAt: string | undefined,
    msgs: Array<{ content: string; created_at: string; author_id: string }>,
  ): GroupSummary => {
    const last = msgs[0]
    const unread = !!last && last.author_id !== userId && (!lastReadAt || new Date(last.created_at) > new Date(lastReadAt))
    return {
      type: 'group', id, kind, name,
      lastMessagePreview: last ? last.content : null,
      lastMessageAt: last ? last.created_at : null,
      unread,
    }
  }

  const ministryMsgsByMinistry = new Map<string, Array<{ content: string; created_at: string; author_id: string }>>()
  for (const m of ministryMsgs ?? []) {
    if (!ministryMsgsByMinistry.has(m.ministry_id)) ministryMsgsByMinistry.set(m.ministry_id, [])
    ministryMsgsByMinistry.get(m.ministry_id)!.push(m)
  }
  const schoolMsgsBySchool = new Map<string, Array<{ content: string; created_at: string; author_id: string }>>()
  for (const m of schoolMsgs ?? []) {
    if (!schoolMsgsBySchool.has(m.school_id)) schoolMsgsBySchool.set(m.school_id, [])
    schoolMsgsBySchool.get(m.school_id)!.push(m)
  }

  const ministryReadAt = new Map((ministryReads ?? []).map(r => [r.ministry_id, r.last_read_at]))
  const schoolReadAt = new Map((schoolReads ?? []).map(r => [r.school_id, r.last_read_at]))

  const ministryGroups = ministries.map(m => buildGroup(
    m.id, 'ministerio', m.name, ministryReadAt.get(m.id), ministryMsgsByMinistry.get(m.id) ?? [],
  ))
  const schoolGroups = schools.map(s => buildGroup(
    s.id, 'escola', s.name, schoolReadAt.get(s.id), schoolMsgsBySchool.get(s.id) ?? [],
  ))

  return [...ministryGroups, ...schoolGroups]
}
