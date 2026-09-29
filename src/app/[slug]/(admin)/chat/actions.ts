'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { after } from 'next/server'
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

// Resultado das ações da conversa: nada de revalidatePath — a tela já
// mostrou a mudança na hora (otimista, ver ChatThread.tsx) e a outra pessoa
// recebe via Realtime (migration 150). Recarregar a rota inteira a cada
// mensagem era o que deixava o chat lento. Erro volta como valor (não
// throw) porque em produção o Next esconde a mensagem de erro lançada.
export type ChatActionResult = { error?: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function sendMessage(input: {
  conversationId: string
  /** Gerado no navegador — a mensagem já aparece na tela com o id definitivo, e reenviar não duplica. */
  id: string
  content: string
  /** Pra onde a notificação push leva quem receber. */
  path?: string
}): Promise<ChatActionResult> {
  const { userId } = await requireUser()
  const content = input.content?.trim()
  if (!input.conversationId || !content) return {}
  if (!UUID_RE.test(input.id)) return { error: 'Mensagem inválida.' }

  const db = createAdminClient()
  const [{ data: participant }, { data: convo }, { data: others }] = await Promise.all([
    db.from('chat_participants').select('conversation_id')
      .eq('conversation_id', input.conversationId).eq('user_id', userId).maybeSingle(),
    db.from('chat_conversations').select('organization_id').eq('id', input.conversationId).maybeSingle(),
    db.from('chat_participants').select('user_id')
      .eq('conversation_id', input.conversationId).neq('user_id', userId),
  ])
  if (!participant) return { error: 'Você não faz parte dessa conversa.' }
  if (!convo) return { error: 'Conversa não encontrada.' }

  const otherUserId = others?.[0]?.user_id
  if (otherUserId) {
    const result = await canMessage(convo.organization_id, userId, otherUserId, false)
    if (!result.allowed) return { error: result.reason }
  }

  const { error } = await db.from('chat_messages').insert({
    id: input.id,
    conversation_id: input.conversationId,
    organization_id: convo.organization_id,
    author_id: userId,
    content,
  })
  // 23505 = id já existe: é um reenvio de algo que já tinha entrado.
  if (error && error.code !== '23505') return { error: 'Não foi possível enviar a mensagem.' }

  await db.from('chat_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', input.conversationId)

  // Poda + push depois da resposta: quem enviou não espera por isso.
  after(async () => {
    const { data: excess } = await db.from('chat_messages')
      .select('id').eq('conversation_id', input.conversationId)
      .order('created_at', { ascending: false })
      .range(MESSAGE_CAP, 999)
    if (excess?.length) await db.from('chat_messages').delete().in('id', excess.map(e => e.id))

    // Push nativo direto (sem passar pela fila notification_events/cron de
    // 1 min — lenta demais pra "alguém te mandou mensagem agora"). Falha
    // silenciosamente se a pessoa não tiver token nativo (só Capacitor tem
    // push hoje, ver PushNotificationManager.tsx).
    if (otherUserId) {
      const senderName = (await resolveNames(db, convo.organization_id, [userId])).get(userId) ?? 'Alguém'
      await sendPushToUsers([otherUserId], {
        title: senderName,
        body: content.length > 80 ? `${content.slice(0, 80)}…` : content,
        data: input.path ? { url: input.path } : undefined,
      })
    }
  })

  return {}
}

// Edita/exclui só a própria mensagem, só dentro da janela de tempo
// (MESSAGE_EDIT_WINDOW_MS) — mesmo espírito do WhatsApp. A UI já esconde os
// botões fora da janela, mas quem chama a action direto (ou com um clique
// que já estava na tela há tempo) esbarra nessa checagem de verdade.
async function ownMessageInWindow(db: ReturnType<typeof createAdminClient>, userId: string, messageId: string, verb: string) {
  const { data: message } = await db.from('chat_messages')
    .select('author_id, created_at').eq('id', messageId).maybeSingle()
  if (!message) return 'Mensagem não encontrada.'
  if (message.author_id !== userId) return `Você só pode ${verb} suas próprias mensagens.`
  if (Date.now() - new Date(message.created_at).getTime() > MESSAGE_EDIT_WINDOW_MS) {
    return `O tempo pra ${verb} essa mensagem já passou.`
  }
  return null
}

export async function editMessage(input: { messageId: string; content: string }): Promise<ChatActionResult> {
  const { userId } = await requireUser()
  const content = input.content?.trim()
  if (!input.messageId || !content) return {}

  const db = createAdminClient()
  const problem = await ownMessageInWindow(db, userId, input.messageId, 'editar')
  if (problem) return { error: problem }

  const { error } = await db.from('chat_messages')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', input.messageId)
  return error ? { error: 'Não foi possível editar a mensagem.' } : {}
}

export async function deleteMessage(input: { messageId: string }): Promise<ChatActionResult> {
  const { userId } = await requireUser()
  if (!input.messageId) return {}

  const db = createAdminClient()
  const problem = await ownMessageInWindow(db, userId, input.messageId, 'excluir')
  if (problem) return { error: problem }

  const { error } = await db.from('chat_messages').delete().eq('id', input.messageId)
  return error ? { error: 'Não foi possível excluir a mensagem.' } : {}
}

// last_read_at é o que acende os dois certinhos (✓✓) pra quem mandou
// (ChatThread.tsx, via Realtime — migration 151). Nunca fica antes da
// última mensagem: o horário dela vem do relógio do banco e "agora" vem do
// servidor da aplicação — uma diferença de milissegundos entre os dois não
// pode deixar uma mensagem já vista com um certinho só.
export async function markConversationRead(conversationId: string) {
  const { userId } = await requireUser()
  const db = createAdminClient()
  const { data: latest } = await db.from('chat_messages')
    .select('created_at').eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  const now = new Date().toISOString()
  const readAt = latest?.created_at && latest.created_at > now ? latest.created_at : now
  await db.from('chat_participants')
    .update({ last_read_at: readAt })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

// "Entregue" (✓✓ cinza pra quem mandou): o SISGO desta pessoa está aberto
// e recebeu as mensagens. Chamado pelo ChatDeliveryListener (todas as telas)
// ao abrir/voltar pro app e a cada mensagem nova que chega pelo Realtime.
// A função do banco (migration 152) usa o relógio do banco e só mexe nas
// conversas que têm mensagem nova da outra pessoa.
export async function markChatDelivered() {
  const { userId } = await requireUser()
  await createAdminClient().rpc('mark_chat_delivered', { p_user_id: userId })
}

// Reação rápida numa mensagem ("joinha" etc.) — clicar de novo no mesmo
// emoji remove; clicar num emoji diferente troca (1 reação por pessoa por
// mensagem, ver migration 143).
export async function toggleReaction(input: { messageId: string; emoji: string }): Promise<ChatActionResult> {
  const { userId } = await requireUser()
  if (!input.messageId || !REACTION_EMOJIS.includes(input.emoji)) return {}

  const db = createAdminClient()
  const { data: message } = await db.from('chat_messages').select('conversation_id').eq('id', input.messageId).maybeSingle()
  if (!message) return { error: 'Mensagem não encontrada.' }
  const [{ data: participant }, { data: existing }] = await Promise.all([
    db.from('chat_participants').select('conversation_id')
      .eq('conversation_id', message.conversation_id).eq('user_id', userId).maybeSingle(),
    db.from('chat_message_reactions').select('emoji')
      .eq('message_id', input.messageId).eq('user_id', userId).maybeSingle(),
  ])
  if (!participant) return { error: 'Você não faz parte dessa conversa.' }

  const { error } = existing?.emoji === input.emoji
    ? await db.from('chat_message_reactions').delete().eq('message_id', input.messageId).eq('user_id', userId)
    : await db.from('chat_message_reactions').upsert(
      { message_id: input.messageId, user_id: userId, emoji: input.emoji },
      { onConflict: 'message_id,user_id' },
    )
  return error ? { error: 'Não foi possível reagir.' } : {}
}

/** Busca de pessoa pro "nova conversa" — aceita "@nome" (ver chat-access.ts). */
export async function searchPeopleToMessage(orgId: string, query: string): Promise<ChatPerson[]> {
  const { userId } = await requireUser()
  if (query.trim().replace(/^@+/, '').length < 2) return []
  return searchEligiblePeople(orgId, query, userId)
}
