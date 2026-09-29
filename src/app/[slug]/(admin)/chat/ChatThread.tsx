'use client'

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Send, ChevronLeft, SmilePlus, Pencil, Trash2, Check, CheckCheck, X, Clock, AlertCircle, Users } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmojiPicker } from './EmojiPicker'
import { REACTION_EMOJIS, isStickerContent } from './emoji'
import { MESSAGE_EDIT_WINDOW_MS } from './config'
import type { ChatActionResult } from './actions'
import type { ChatMessage, ConversationKind, MessageReaction } from './types'

// Conversa no estilo WhatsApp: tudo o que a pessoa faz aparece na hora
// (otimista) e o servidor confirma por trás — nada de esperar a action nem
// recarregar a rota. O que a OUTRA pessoa faz chega pelo Realtime do
// Supabase (migration 150), sem precisar atualizar a página.

type LocalMessage = ChatMessage & {
  /** Só em mensagem própria ainda não confirmada: 'sending' (relógio) ou 'failed' (tentar de novo). */
  status?: 'sending' | 'failed'
}

type Props = {
  conversationId: string
  /** 'geral' = grupão da base (migration 153): mostra quem escreveu cada mensagem. */
  kind: ConversationKind
  /** Nome da outra pessoa (dm) ou "Geral". */
  title: string
  subtitle: string | null
  avatarUrl: string | null
  /** Nome de cada membro do Geral, pra legenda dos balões. */
  authorNames: Record<string, string>
  currentUserId: string
  messages: ChatMessage[]
  /** Até quando a outra pessoa leu a conversa — ✓✓ azul. */
  otherLastReadAt: string | null
  /** Até quando as mensagens chegaram no aparelho da outra pessoa — ✓✓ cinza (migration 152). */
  otherLastDeliveredAt: string | null
  path: string
  sendMessageAction: (input: { conversationId: string; id: string; content: string; path?: string }) => Promise<ChatActionResult>
  toggleReactionAction: (input: { messageId: string; emoji: string }) => Promise<ChatActionResult>
  editMessageAction: (input: { messageId: string; content: string }) => Promise<ChatActionResult>
  deleteMessageAction: (input: { messageId: string }) => Promise<ChatActionResult>
  markReadAction: (conversationId: string) => Promise<void>
}

const OFFLINE: ChatActionResult = { error: 'Sem conexão com o servidor.' }
const NEAR_BOTTOM_PX = 120

// randomUUID só existe em contexto seguro (https/localhost) e navegadores
// recentes; o fallback monta um UUID v4 com getRandomValues.
function newMessageId(): string {
  const c: Crypto = globalThis.crypto
  if (typeof c.randomUUID === 'function') return c.randomUUID()
  const b = c.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Uma reação por pessoa por mensagem (mesma regra do banco): tira a pessoa de onde estava e, se `emoji`, põe no novo. */
function applyReaction(reactions: MessageReaction[], userId: string, emoji: string | null): MessageReaction[] {
  const next = reactions
    .map(r => ({ ...r, userIds: r.userIds.filter(id => id !== userId) }))
    .filter(r => r.userIds.length > 0)
  if (!emoji) return next
  const existing = next.find(r => r.emoji === emoji)
  if (existing) existing.userIds = [...existing.userIds, userId]
  else next.push({ emoji, userIds: [userId] })
  return next
}

// Por data, não por texto: o banco devolve "…56.123456+00:00" e o navegador
// gera "…56.123Z" — comparar as strings mistura os dois formatos.
const time = (iso: string) => new Date(iso).getTime()
const byCreatedAt = (a: ChatMessage, b: ChatMessage) => time(a.createdAt) - time(b.createdAt)

// Cor fixa por pessoa no Geral (mesma pessoa, mesma cor), como no WhatsApp.
const AUTHOR_COLORS = ['text-rose-600', 'text-sky-700', 'text-emerald-700', 'text-violet-700', 'text-amber-700', 'text-teal-700', 'text-fuchsia-700', 'text-indigo-700']
function authorColor(userId: string) {
  let h = 0
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AUTHOR_COLORS[h % AUTHOR_COLORS.length]
}
const latest = (a: string | null, b: string | null) => (!a ? b : !b ? a : time(b) > time(a) ? b : a)

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  const same = (x: Date, y: Date) => x.toDateString() === y.toDateString()
  if (same(d, today)) return 'Hoje'
  if (same(d, yesterday)) return 'Ontem'
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  }).replace('.', '')
}

export function ChatThread({
  conversationId, kind, title, subtitle, avatarUrl, authorNames, currentUserId, messages, otherLastReadAt, otherLastDeliveredAt, path,
  sendMessageAction, toggleReactionAction, editMessageAction, deleteMessageAction, markReadAction,
}: Props) {
  const [list, setList] = useState<LocalMessage[]>(messages)
  const [draft, setDraft] = useState('')
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [otherReadAt, setOtherReadAt] = useState(otherLastReadAt)
  const [otherDeliveredAt, setOtherDeliveredAt] = useState(otherLastDeliveredAt)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const forceScrollRef = useRef(true)
  // Apagada aqui mas ainda presente num snapshot do servidor que chegue
  // atrasado (router.refresh da lista de conversas) — não pode "ressuscitar".
  const deletedIdsRef = useRef(new Set<string>())
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref: a action chega do servidor e pode mudar de identidade a cada
  // atualização da página — não pode derrubar e refazer a assinatura.
  const markReadRef = useRef(markReadAction)
  useEffect(() => { markReadRef.current = markReadAction }, [markReadAction])
  // Chegou mensagem da outra pessoa com a aba escondida: só conta como lida
  // quando a pessoa voltar pra aba (senão quem mandou veria ✓✓ sem ter sido visto).
  const unseenWhileHiddenRef = useRef(false)

  useEffect(() => { setOtherReadAt(prev => latest(prev, otherLastReadAt)) }, [otherLastReadAt])
  useEffect(() => { setOtherDeliveredAt(prev => latest(prev, otherLastDeliveredAt)) }, [otherLastDeliveredAt])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || !unseenWhileHiddenRef.current) return
      unseenWhileHiddenRef.current = false
      markReadRef.current(conversationId).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [conversationId])

  // Snapshot novo do servidor: ele manda, mas o que ainda não foi confirmado
  // (enviando/falhou) continua na tela.
  useEffect(() => {
    setList(prev => {
      const serverIds = new Set(messages.map(m => m.id))
      const pending = prev.filter(m => m.status && !serverIds.has(m.id))
      return [...messages.filter(m => !deletedIdsRef.current.has(m.id)), ...pending].sort(byCreatedAt)
    })
  }, [messages])

  // ── Realtime: o que a outra pessoa (ou eu, em outra aba) faz ─────────────
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const scheduleMarkRead = () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current)
      if (document.visibilityState !== 'visible') {
        unseenWhileHiddenRef.current = true
        return
      }
      markReadTimerRef.current = setTimeout(() => {
        markReadRef.current(conversationId).catch(() => {})
      }, 800)
    }

    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) supabase.realtime.setAuth(session.access_token)
      if (cancelled) return

      type Row = { id: string; author_id: string; content: string; created_at: string; edited_at: string | null }
      type ReactionRow = { message_id: string; user_id: string; emoji?: string }
      type ParticipantRow = { user_id: string; last_read_at: string | null; last_delivered_at: string | null }
      const filter = `conversation_id=eq.${conversationId}`

      channel = supabase.channel(`chat-thread-${conversationId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter }, payload => {
          const row = payload.new as Row
          setList(prev => {
            if (prev.some(m => m.id === row.id)) {
              // Eco da minha própria mensagem: vira "enviada" com a hora do servidor.
              return prev.map(m => m.id === row.id ? { ...m, createdAt: row.created_at, status: undefined } : m)
            }
            return [...prev, {
              id: row.id, authorId: row.author_id, content: row.content,
              createdAt: row.created_at, editedAt: row.edited_at, reactions: [],
            }].sort(byCreatedAt)
          })
          if (row.author_id !== currentUserId) scheduleMarkRead()
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter }, payload => {
          const row = payload.new as Row
          setList(prev => prev.map(m => m.id === row.id ? { ...m, content: row.content, editedAt: row.edited_at } : m))
        })
        // DELETE não aceita filtro no Realtime e só traz a chave (id) — basta
        // tirar da tela se for desta conversa.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, payload => {
          const id = (payload.old as { id?: string }).id
          if (id) setList(prev => prev.filter(m => m.id !== id))
        })
      // Mensagem chegou no aparelho da outra pessoa (✓✓ cinza) ou ela abriu a
      // conversa (✓✓ azul) — migrations 151/152. Só na conversa 1-a-1: no
      // Geral cada leitura de cada membro viraria um evento pra todo mundo
      // (dezenas de pessoas × dezenas de leituras); lá os certinhos se
      // atualizam junto com a página quando chega mensagem nova.
      if (kind === 'dm') {
        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_participants', filter }, payload => {
          const row = payload.new as ParticipantRow
          if (row.user_id === currentUserId) return
          if (row.last_read_at) setOtherReadAt(prev => latest(prev, row.last_read_at))
          if (row.last_delivered_at) setOtherDeliveredAt(prev => latest(prev, row.last_delivered_at))
        })
      }
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reactions' }, payload => {
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as ReactionRow
          if (!row?.message_id || !row.user_id) return
          const emoji = payload.eventType === 'DELETE' ? null : row.emoji ?? null
          setList(prev => prev.map(m => m.id === row.message_id
            ? { ...m, reactions: applyReaction(m.reactions, row.user_id, emoji) }
            : m))
        })
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current)
      if (channel) supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId, kind])

  // ── Rolagem: desce sozinho só se a pessoa já estava no fim (ou acabou de mandar) ──
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (forceScrollRef.current || nearBottomRef.current) el.scrollTop = el.scrollHeight
    forceScrollRef.current = false
  }, [list.length])

  function onScroll() {
    const el = scrollRef.current
    if (el) nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  // Campo cresce com o texto (até ~5 linhas), igual ao mural.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [draft])

  // ── Envio ─────────────────────────────────────────────────────────────────
  async function deliver(message: LocalMessage) {
    const result = await sendMessageAction({ conversationId, id: message.id, content: message.content, path }).catch(() => OFFLINE)
    setList(prev => prev.map(m => m.id === message.id ? { ...m, status: result.error ? 'failed' : undefined } : m))
    if (result.error) toast.error(result.error)
  }

  function send() {
    const content = draft.trim()
    if (!content) return
    const message: LocalMessage = {
      id: newMessageId(), authorId: currentUserId, content,
      createdAt: new Date().toISOString(), editedAt: null, reactions: [], status: 'sending',
    }
    forceScrollRef.current = true
    setList(prev => [...prev, message])
    setDraft('')
    textareaRef.current?.focus()
    // Sem trava: dá pra mandar outra em seguida. O Next executa as actions
    // em fila, então a ordem de chegada no servidor é a ordem de envio.
    void deliver(message)
  }

  function retry(message: LocalMessage) {
    setList(prev => prev.map(m => m.id === message.id ? { ...m, status: 'sending' } : m))
    void deliver(message)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // ── Editar / excluir / reagir: aplica na hora, desfaz se o servidor recusar ──
  async function edit(message: LocalMessage, content: string) {
    const before = message
    setList(prev => prev.map(m => m.id === message.id ? { ...m, content, editedAt: new Date().toISOString() } : m))
    const result = await editMessageAction({ messageId: message.id, content }).catch(() => OFFLINE)
    if (result.error) {
      setList(prev => prev.map(m => m.id === message.id ? before : m))
      toast.error(result.error)
    }
  }

  async function remove(message: LocalMessage) {
    deletedIdsRef.current.add(message.id)
    setList(prev => prev.filter(m => m.id !== message.id))
    const result = await deleteMessageAction({ messageId: message.id }).catch(() => OFFLINE)
    if (result.error) {
      deletedIdsRef.current.delete(message.id)
      setList(prev => [...prev, message].sort(byCreatedAt))
      toast.error(result.error)
    }
  }

  async function react(message: LocalMessage, emoji: string) {
    const mine = message.reactions.find(r => r.userIds.includes(currentUserId))?.emoji ?? null
    const target = mine === emoji ? null : emoji
    setList(prev => prev.map(m => m.id === message.id ? { ...m, reactions: applyReaction(m.reactions, currentUserId, target) } : m))
    const result = await toggleReactionAction({ messageId: message.id, emoji }).catch(() => OFFLINE)
    if (result.error) {
      setList(prev => prev.map(m => m.id === message.id ? { ...m, reactions: applyReaction(m.reactions, currentUserId, mine) } : m))
      toast.error(result.error)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
        <Link href={path.split('/').slice(0, -1).join('/')} className="lg:hidden p-1 -ml-1 text-gray-400 hover:text-gray-600" aria-label="Voltar">
          <ChevronLeft size={20} />
        </Link>
        {kind === 'geral' ? (
          <span className="shrink-0 w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
            <Users size={15} />
          </span>
        ) : avatarUrl ? (
          <button type="button" onClick={() => setAvatarOpen(true)} className="shrink-0" aria-label="Ver foto do perfil">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto de perfil do usuário, não passa pelo otimizador */}
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          </button>
        ) : (
          <span className="shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
            {title.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 truncate">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
        </div>
      </div>

      {avatarOpen && avatarUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setAvatarOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- foto de perfil do usuário, não passa pelo otimizador */}
          <img src={avatarUrl} alt={title} className="max-w-xs w-full aspect-square rounded-full object-cover shadow-2xl" />
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {list.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">Nenhuma mensagem ainda. Diga oi!</p>
        )}
        {list.map((m, i) => {
          const showDay = i === 0 || dayLabel(list[i - 1].createdAt) !== dayLabel(m.createdAt)
          // No Geral, o nome de quem escreveu aparece no começo de cada sequência dela.
          const showAuthor = kind === 'geral' && m.authorId !== currentUserId
            && (showDay || list[i - 1].authorId !== m.authorId)
          return (
            <Fragment key={m.id}>
              {showDay && (
                <div className="flex justify-center py-1">
                  <span className="text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">{dayLabel(m.createdAt)}</span>
                </div>
              )}
              <MessageBubble
                message={m}
                isOwn={m.authorId === currentUserId}
                authorName={showAuthor ? authorNames[m.authorId] ?? 'Obreiro' : null}
                receipt={
                  m.status ? 'pending'
                    : otherReadAt && time(m.createdAt) <= time(otherReadAt) ? 'read'
                      : otherDeliveredAt && time(m.createdAt) <= time(otherDeliveredAt) ? 'delivered'
                        : 'sent'
                }
                currentUserId={currentUserId}
                active={activeId === m.id}
                onToggleActive={() => setActiveId(id => (id === m.id ? null : m.id))}
                onRetry={() => retry(m)}
                onEdit={content => edit(m, content)}
                onDelete={() => remove(m)}
                onReact={emoji => react(m, emoji)}
              />
            </Fragment>
          )
        })}
      </div>

      <form
        onSubmit={e => { e.preventDefault(); send() }}
        className="flex items-end gap-2 px-3 py-2.5 border-t border-gray-100 shrink-0"
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Escreva uma mensagem…"
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 max-h-32"
        />
        <EmojiPicker onSelect={emoji => setDraft(prev => `${prev}${emoji}`)} />
        <button
          type="submit"
          // onMouseDown/preventDefault: tocar em Enviar não tira o foco do campo
          // (no celular o teclado continua aberto, como no WhatsApp).
          onMouseDown={e => e.preventDefault()}
          disabled={!draft.trim()}
          className="p-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white transition-colors shrink-0"
          aria-label="Enviar"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}

function MessageBubble({ message, isOwn, authorName, receipt, currentUserId, active, onToggleActive, onRetry, onEdit, onDelete, onReact }: {
  message: LocalMessage
  isOwn: boolean
  /** Nome de quem escreveu (só no Geral, no começo de cada sequência). */
  authorName: string | null
  /** Certinhos de mensagem própria, igual ao WhatsApp: ✓ enviada, ✓✓ cinza entregue, ✓✓ azul vista. */
  receipt: 'pending' | 'sent' | 'delivered' | 'read'
  currentUserId: string
  active: boolean
  onToggleActive: () => void
  onRetry: () => void
  onEdit: (content: string) => void
  onDelete: () => void
  onReact: (emoji: string) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editDraft, setEditDraft] = useState(message.content)
  const sticker = isStickerContent(message.content)
  const clock = new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  // Ainda não confirmada pelo servidor: sem editar/excluir/reagir até entrar.
  const confirmed = !message.status
  const withinEditWindow = confirmed && (Date.now() - new Date(message.createdAt).getTime()) < MESSAGE_EDIT_WINDOW_MS
  const canEditOrDelete = isOwn && withinEditWindow

  function saveEdit() {
    const content = editDraft.trim()
    if (!content) return
    setEditing(false)
    if (content !== message.content) onEdit(content)
  }

  if (editing) {
    return (
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        <form onSubmit={e => { e.preventDefault(); saveEdit() }} className="max-w-[80%] w-full flex items-end gap-1.5">
          <textarea
            value={editDraft}
            onChange={e => setEditDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() }
              if (e.key === 'Escape') setEditing(false)
            }}
            autoFocus
            rows={1}
            className="flex-1 resize-none rounded-xl border border-brand-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 max-h-32"
          />
          <button type="submit" disabled={!editDraft.trim()} className="p-1.5 text-brand-600 hover:text-brand-800 disabled:opacity-40 shrink-0" aria-label="Salvar edição">
            <Check size={16} />
          </button>
          <button type="button" onClick={() => setEditing(false)} className="p-1.5 text-gray-400 hover:text-gray-600 shrink-0" aria-label="Cancelar edição">
            <X size={16} />
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
      {authorName && (
        <span className={`text-[11px] font-semibold px-1 mb-0.5 ${authorColor(message.authorId)}`}>{authorName}</span>
      )}
      {/* Tocar na mensagem mostra as ações (no celular não existe hover). */}
      <button type="button" onClick={onToggleActive} className={`max-w-[80%] text-left ${isOwn ? 'self-end' : 'self-start'}`}>
        {sticker ? (
          <span className={`block text-4xl leading-none px-1 ${message.status ? 'opacity-60' : ''}`}>{message.content}</span>
        ) : (
          <span className={`block rounded-2xl px-3 py-2 text-sm transition-opacity ${isOwn ? 'bg-brand-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'} ${message.status === 'sending' ? 'opacity-70' : ''} ${message.status === 'failed' ? 'ring-2 ring-red-300' : ''}`}>
            <span className="block whitespace-pre-wrap break-words">{message.content}</span>
          </span>
        )}
      </button>
      <div className="flex items-center gap-1.5 mt-0.5 px-1">
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          {clock}{message.editedAt && ' · editado'}
          {isOwn && message.status === 'sending' && <Clock size={10} aria-label="Enviando" />}
          {isOwn && receipt === 'sent' && <Check size={11} aria-label="Enviada" />}
          {isOwn && receipt === 'delivered' && <CheckCheck size={13} aria-label="Entregue" />}
          {isOwn && receipt === 'read' && <CheckCheck size={13} className="text-sky-500" aria-label="Vista" />}
        </span>
        {message.status === 'failed' && (
          <button type="button" onClick={onRetry} className="flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700">
            <AlertCircle size={12} /> Não enviada · Tentar de novo
          </button>
        )}
        {confirmed && (
          <div className={`flex items-center gap-0.5 transition-opacity focus-within:opacity-100 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {canEditOrDelete && (
              <>
                <button
                  type="button"
                  onClick={() => { setEditDraft(message.content); setEditing(true) }}
                  className="p-0.5 text-gray-300 hover:text-gray-500"
                  aria-label="Editar mensagem"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="p-0.5 text-gray-300 hover:text-red-500"
                  aria-label="Excluir mensagem"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen(o => !o)}
                className="p-0.5 text-gray-300 hover:text-gray-500"
                aria-label="Reagir"
              >
                <SmilePlus size={13} />
              </button>
              {pickerOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                  <div className={`absolute bottom-full mb-1 z-20 flex items-center gap-0.5 bg-white border border-gray-200 rounded-full shadow-lg px-1.5 py-1 ${isOwn ? 'right-0' : 'left-0'}`}>
                    {REACTION_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => { setPickerOpen(false); onReact(emoji) }}
                        className="text-base leading-none p-1 rounded-full hover:bg-gray-100"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {message.reactions.length > 0 && (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {message.reactions.map(r => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onReact(r.emoji)}
              className={`text-xs rounded-full px-1.5 py-0.5 border transition-colors ${r.userIds.includes(currentUserId) ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            >
              {r.emoji} {r.userIds.length}
            </button>
          ))}
        </div>
      )}
      <ConfirmModal
        open={confirmDelete}
        message="Excluir esta mensagem? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => { setConfirmDelete(false); onDelete() }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
