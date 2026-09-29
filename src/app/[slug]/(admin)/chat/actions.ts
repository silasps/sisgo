'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { canMessage, searchEligiblePeople } from '@/lib/auth/chat-access'
import { sendPushToUsers } from '@/lib/notifications/push'
import { REACTION_EMOJIS } from './emoji'
import { resolveNames } from './_data'
import { MESSAGE_EDIT_WINDOW_MS } from './config'
import type { ChatPerson } from './types'

// Retenção proposital baixa (o usuário foi explícito: não quer o Chat
// virando um arquivo permanente) — mesmo mecanismo de poda por inserção já
// usado no mural (ver ministerios/[id]/page.tsx:postMessage), só com um
// teto maior (200) porque uma DM 1-a-1 é mais "conversa de verdade" que um
// mural em grupo.
const MESSAGE_CAP = 200

type Ctx = { userId: string }

async function requireUser(): Promise<Ctx> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')
  return { userId: user.id }
}

export async function getOrCreateDirectConversation(orgId: string, otherUserId: string): Promise<string> {
  const { userId } = await requireUser()
  if (userId === otherUserId) throw new Error('Não é possível conversar consigo mesmo.')

  const result = await canMessage(orgId, userId, otherUserId, true)
  if (!result.allowed) throw new Error(result.reason)

  const db = createAdminClient()
  // Par ordenado: sempre exatamente 2 linhas em chat_participants por DM —
  // achar uma conversa existente é achar uma conversa onde ambos aparecem.
  const { data: myConvos } = await db.from('chat_participants').select('conversation_id').eq('user_id', userId)
  const myIds = (myConvos ?? []).map(r => r.conversation_id)
  if (myIds.length > 0) {
    const { data: shared } = await db.from('chat_participants')
      .select('conversation_id').eq('user_id', otherUserId).in('conversation_id', myIds).limit(1)
    if (shared && shared.length > 0) return shared[0].conversation_id
  }

  const { data: convo, error } = await db.from('chat_conversations').insert({ organization_id: orgId }).select('id').single()
  if (error || !convo) throw new Error(error?.message ?? 'Não foi possível iniciar a conversa.')

  const { error: partError } = await db.from('chat_participants').insert([
    { conversation_id: convo.id, user_id: userId },
    { conversation_id: convo.id, user_id: otherUserId },
  ])
  if (partError) throw new Error(partError.message)

  return convo.id
}

export async function sendMessage(formData: FormData) {
  const { userId } = await requireUser()
  const conversationId = formData.get('conversation_id') as string
  const content = (formData.get('content') as string)?.trim()
  const path = formData.get('path') as string
  if (!conversationId || !content) return

  const db = createAdminClient()
  const { data: participant } = await db.from('chat_participants')
    .select('conversation_id').eq('conversation_id', conversationId).eq('user_id', userId).maybeSingle()
  if (!participant) throw new Error('Você não faz parte dessa conversa.')

  const { data: convo } = await db.from('chat_conversations').select('organization_id').eq('id', conversationId).single()
  if (!convo) throw new Error('Conversa não encontrada.')

  const { data: others } = await db.from('chat_participants')
    .select('user_id').eq('conversation_id', conversationId).neq('user_id', userId)
  const otherUserId = others?.[0]?.user_id
  if (otherUserId) {
    const result = await canMessage(convo.organization_id, userId, otherUserId, false)
    if (!result.allowed) throw new Error(result.reason)
  }

  const { error } = await db.from('chat_messages').insert({
    conversation_id: conversationId,
    organization_id: convo.organization_id,
    author_id: userId,
    content,
  })
  if (error) throw new Error(error.message)

  await db.from('chat_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)

  const { data: excess } = await db.from('chat_messages')
    .select('id').eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(MESSAGE_CAP, 999)
  if (excess?.length) {
    await db.from('chat_messages').delete().in('id', excess.map(e => e.id))
  }

  // Push nativo direto (sem passar pela fila notification_events/cron de
  // 1 min — lenta demais pra "alguém te mandou mensagem agora"). Falha
  // silenciosamente se a pessoa não tiver token nativo (só Capacitor tem
  // push hoje, ver PushNotificationManager.tsx).
  if (otherUserId) {
    const senderName = (await resolveNames(db, convo.organization_id, [userId])).get(userId) ?? 'Alguém'
    await sendPushToUsers([otherUserId], {
      title: senderName,
      body: content.length > 80 ? `${content.slice(0, 80)}…` : content,
      data: path ? { url: path } : undefined,
    })
  }

  if (path) revalidatePath(path)
}

// Edita/exclui só a própria mensagem, só dentro da janela de tempo
// (MESSAGE_EDIT_WINDOW_MS) — mesmo espírito do WhatsApp. A UI já esconde os
// botões fora da janela, mas quem chama a action direto (ou com um clique
// que já estava na tela há tempo) esbarra nessa checagem de verdade.
export async function editMessage(formData: FormData) {
  const { userId } = await requireUser()
  const messageId = formData.get('message_id') as string
  const content = (formData.get('content') as string)?.trim()
  const path = formData.get('path') as string
  if (!messageId || !content) return

  const db = createAdminClient()
  const { data: message } = await db.from('chat_messages')
    .select('author_id, created_at').eq('id', messageId).single()
  if (!message) throw new Error('Mensagem não encontrada.')
  if (message.author_id !== userId) throw new Error('Você só pode editar suas próprias mensagens.')
  if (Date.now() - new Date(message.created_at).getTime() > MESSAGE_EDIT_WINDOW_MS) {
    throw new Error('O tempo pra editar essa mensagem já passou.')
  }

  const { error } = await db.from('chat_messages')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', messageId)
  if (error) throw new Error(error.message)

  if (path) revalidatePath(path)
}

export async function deleteMessage(formData: FormData) {
  const { userId } = await requireUser()
  const messageId = formData.get('message_id') as string
  const path = formData.get('path') as string
  if (!messageId) return

  const db = createAdminClient()
  const { data: message } = await db.from('chat_messages')
    .select('author_id, created_at').eq('id', messageId).single()
  if (!message) throw new Error('Mensagem não encontrada.')
  if (message.author_id !== userId) throw new Error('Você só pode excluir suas próprias mensagens.')
  if (Date.now() - new Date(message.created_at).getTime() > MESSAGE_EDIT_WINDOW_MS) {
    throw new Error('O tempo pra excluir essa mensagem já passou.')
  }

  const { error } = await db.from('chat_messages').delete().eq('id', messageId)
  if (error) throw new Error(error.message)

  if (path) revalidatePath(path)
}

export async function markConversationRead(conversationId: string) {
  const { userId } = await requireUser()
  const db = createAdminClient()
  await db.from('chat_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

// Reação rápida numa mensagem ("joinha" etc.) — clicar de novo no mesmo
// emoji remove; clicar num emoji diferente troca (1 reação por pessoa por
// mensagem, ver migration 143).
export async function toggleReaction(formData: FormData) {
  const { userId } = await requireUser()
  const messageId = formData.get('message_id') as string
  const emoji = formData.get('emoji') as string
  const path = formData.get('path') as string
  if (!messageId || !REACTION_EMOJIS.includes(emoji)) return

  const db = createAdminClient()
  const { data: message } = await db.from('chat_messages').select('conversation_id').eq('id', messageId).single()
  if (!message) throw new Error('Mensagem não encontrada.')
  const { data: participant } = await db.from('chat_participants')
    .select('conversation_id').eq('conversation_id', message.conversation_id).eq('user_id', userId).maybeSingle()
  if (!participant) throw new Error('Você não faz parte dessa conversa.')

  const { data: existing } = await db.from('chat_message_reactions')
    .select('emoji').eq('message_id', messageId).eq('user_id', userId).maybeSingle()

  if (existing?.emoji === emoji) {
    await db.from('chat_message_reactions').delete().eq('message_id', messageId).eq('user_id', userId)
  } else {
    await db.from('chat_message_reactions').upsert(
      { message_id: messageId, user_id: userId, emoji },
      { onConflict: 'message_id,user_id' },
    )
  }
  if (path) revalidatePath(path)
}

/** Busca de pessoa pro "nova conversa" — aceita "@nome" (ver chat-access.ts). */
export async function searchPeopleToMessage(orgId: string, query: string): Promise<ChatPerson[]> {
  const { userId } = await requireUser()
  if (query.trim().replace(/^@+/, '').length < 2) return []
  return searchEligiblePeople(orgId, query, userId)
}
