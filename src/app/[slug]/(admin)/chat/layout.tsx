import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { ChatShell } from './ChatShell'
import { ConversationList } from './ConversationList'
import { resolveNames, resolveAvatars } from './_data'
import type { ChatListItem, ConversationSummary } from './types'

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode }

export default async function ChatLayout({ params, children }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const db = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) redirect('/login')

  // Só conversas — os murais de ministério/escola ficam nas páginas deles.
  const items: ChatListItem[] = (await loadConversations(db, org.id, user.id))
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

  const [nameByUserId, avatarByUserId] = await Promise.all([
    resolveNames(db, orgId, otherUserIds),
    resolveAvatars(db, otherUserIds),
  ])

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
      otherAvatarUrl: avatarByUserId.get(otherUserId) ?? null,
      lastMessagePreview: last ? last.content : null,
      lastMessageAt: lastMessageAtByConvo.get(id) ?? null,
      unread,
    }
  })
}
