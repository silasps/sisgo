import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { ChatShell } from './ChatShell'
import { ConversationList } from './ConversationList'
import { resolveNames, resolveAvatars } from './_data'
import type { ChatListItem, ConversationKind, ConversationSummary } from './types'

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
  // O Geral da base fica fixo no topo; o resto, da mais recente pra mais antiga.
  const items: ChatListItem[] = (await loadConversations(db, org.id, user.id))
    .sort((a, b) => Number(b.kind === 'geral') - Number(a.kind === 'geral')
      || new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime())

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
  const { data: myParts } = await db.from('chat_participants').select('conversation_id, last_read_at, muted').eq('user_id', userId)
  const myIds = (myParts ?? []).map(p => p.conversation_id)
  if (myIds.length === 0) return []
  const lastReadByConvo = new Map((myParts ?? []).map(p => [p.conversation_id, p.last_read_at]))
  const mutedConvos = new Set((myParts ?? []).filter(p => p.muted).map(p => p.conversation_id))

  // Só as conversas DESTA base (quem está em duas bases não mistura as listas).
  const { data: convos } = await db.from('chat_conversations')
    .select('id, kind, last_message_at').in('id', myIds).eq('organization_id', orgId)
  const conversationIds = (convos ?? []).map(c => c.id)
  if (conversationIds.length === 0) return []
  const kindByConvo = new Map((convos ?? []).map(c => [c.id, (c.kind === 'geral' ? 'geral' : 'dm') as ConversationKind]))
  const dmIds = conversationIds.filter(id => kindByConvo.get(id) === 'dm')
  const geralIds = conversationIds.filter(id => kindByConvo.get(id) === 'geral')

  const [{ data: otherParts }, { data: recentMessages }, memberCounts] = await Promise.all([
    // Outra pessoa só das conversas 1-a-1 — no Geral seriam dezenas de linhas à toa.
    dmIds.length > 0
      ? db.from('chat_participants').select('conversation_id, user_id').in('conversation_id', dmIds).neq('user_id', userId)
      : Promise.resolve({ data: [] as Array<{ conversation_id: string; user_id: string }> }),
    db.from('chat_messages')
      .select('conversation_id, content, created_at, author_id')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(500),
    Promise.all(geralIds.map(async id => {
      const { count } = await db.from('chat_participants').select('*', { count: 'exact', head: true }).eq('conversation_id', id)
      return [id, count ?? 0] as const
    })),
  ])

  const otherUserIdByConvo = new Map((otherParts ?? []).map(p => [p.conversation_id, p.user_id]))
  const lastMessageByConvo = new Map<string, { content: string; created_at: string; author_id: string }>()
  for (const m of recentMessages ?? []) {
    if (!lastMessageByConvo.has(m.conversation_id)) lastMessageByConvo.set(m.conversation_id, m)
  }
  // Prévia do Geral mostra quem escreveu ("Ana: ..."), como no WhatsApp.
  const geralAuthorIds = geralIds.map(id => lastMessageByConvo.get(id)?.author_id).filter((id): id is string => !!id && id !== userId)
  const otherUserIds = [...new Set(otherUserIdByConvo.values())]

  const [nameByUserId, avatarByUserId] = await Promise.all([
    resolveNames(db, orgId, [...new Set([...otherUserIds, ...geralAuthorIds])]),
    resolveAvatars(db, otherUserIds),
  ])

  const lastMessageAtByConvo = new Map((convos ?? []).map(c => [c.id, c.last_message_at]))
  const memberCountByConvo = new Map(memberCounts)

  return conversationIds.map((id): ConversationSummary => {
    const kind = kindByConvo.get(id) ?? 'dm'
    const last = lastMessageByConvo.get(id)
    const lastReadAt = lastReadByConvo.get(id)
    const unread = !!last && last.author_id !== userId && (!lastReadAt || new Date(last.created_at) > new Date(lastReadAt))
    const author = !last ? '' : last.author_id === userId ? 'Você' : (nameByUserId.get(last.author_id) ?? 'Alguém').split(' ')[0]
    const otherUserId = otherUserIdByConvo.get(id) ?? ''
    return {
      kind,
      id,
      title: kind === 'geral' ? 'Geral' : nameByUserId.get(otherUserId) ?? 'Pessoa',
      avatarUrl: kind === 'geral' ? null : avatarByUserId.get(otherUserId) ?? null,
      memberCount: kind === 'geral' ? memberCountByConvo.get(id) ?? null : null,
      lastMessagePreview: !last ? null : kind === 'geral' ? `${author}: ${last.content}` : last.content,
      lastMessageAt: lastMessageAtByConvo.get(id) ?? null,
      unread,
      muted: mutedConvos.has(id),
    }
  })
}
