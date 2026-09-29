import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage, toggleReaction, editMessage, deleteMessage, markConversationRead } from '../actions'
import { resolveNames, resolveAvatars } from '../_data'
import { ChatThread } from '../ChatThread'
import type { ChatMessage } from '../types'

type Props = { params: Promise<{ slug: string; conversationId: string }> }

export default async function ChatThreadPage({ params }: Props) {
  const { slug, conversationId } = await params
  const supabase = await createClient()
  const db = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: participant } = await db.from('chat_participants')
    .select('conversation_id').eq('conversation_id', conversationId).eq('user_id', user.id).maybeSingle()
  if (!participant) notFound()

  const { data: convo } = await db.from('chat_conversations').select('organization_id').eq('id', conversationId).single()
  if (!convo) notFound()

  const { data: others } = await db.from('chat_participants')
    .select('user_id').eq('conversation_id', conversationId).neq('user_id', user.id)
  const otherUserId = others?.[0]?.user_id ?? ''

  const [nameByUserId, avatarByUserId, { data: messagesRaw }] = await Promise.all([
    resolveNames(db, convo.organization_id, [otherUserId]),
    resolveAvatars(db, [otherUserId]),
    db.from('chat_messages')
      .select('id, author_id, content, created_at, edited_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
  ])

  const messageIds = (messagesRaw ?? []).map(m => m.id)
  const { data: reactionsRaw } = messageIds.length > 0
    ? await db.from('chat_message_reactions').select('message_id, user_id, emoji').in('message_id', messageIds)
    : { data: [] }

  const reactionsByMessage = new Map<string, Map<string, string[]>>()
  for (const r of reactionsRaw ?? []) {
    if (!reactionsByMessage.has(r.message_id)) reactionsByMessage.set(r.message_id, new Map())
    const byEmoji = reactionsByMessage.get(r.message_id)!
    byEmoji.set(r.emoji, [...(byEmoji.get(r.emoji) ?? []), r.user_id])
  }

  const messages: ChatMessage[] = (messagesRaw ?? []).map(m => ({
    id: m.id,
    authorId: m.author_id,
    content: m.content,
    createdAt: m.created_at,
    editedAt: m.edited_at,
    reactions: [...(reactionsByMessage.get(m.id)?.entries() ?? [])].map(([emoji, userIds]) => ({ emoji, userIds })),
  }))

  // "Lido" = abriu a conversa — mesmo critério que o mural já usa
  // (ministerios/[id]/page.tsx), sem exigir scroll até o fim.
  await markConversationRead(conversationId)

  const path = `/${slug}/chat/${conversationId}`

  return (
    <ChatThread
      conversationId={conversationId}
      otherName={nameByUserId.get(otherUserId) ?? 'Pessoa'}
      otherAvatarUrl={avatarByUserId.get(otherUserId) ?? null}
      currentUserId={user.id}
      messages={messages}
      path={path}
      sendMessageAction={sendMessage}
      toggleReactionAction={toggleReaction}
      editMessageAction={editMessage}
      deleteMessageAction={deleteMessage}
    />
  )
}
