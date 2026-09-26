'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Send, ChevronLeft, SmilePlus } from 'lucide-react'
import Link from 'next/link'
import { EmojiPicker } from './EmojiPicker'
import { REACTION_EMOJIS, isStickerContent } from './emoji'
import type { ChatMessage } from './types'

export function ChatThread({
  conversationId, otherName, currentUserId, messages, path, sendMessageAction, toggleReactionAction,
}: {
  conversationId: string
  otherName: string
  currentUserId: string
  messages: ChatMessage[]
  path: string
  sendMessageAction: (formData: FormData) => Promise<void>
  toggleReactionAction: (formData: FormData) => Promise<void>
}) {
  const [localMessages, setLocalMessages] = useState(messages)
  const [draft, setDraft] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => setLocalMessages(messages), [messages])
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }) }, [localMessages.length])

  async function submit(formData: FormData) {
    const content = (formData.get('content') as string)?.trim()
    if (!content) return
    setLocalMessages(prev => [...prev, {
      id: `temp-${Date.now()}`, authorId: currentUserId, content,
      createdAt: new Date().toISOString(), editedAt: null, reactions: [],
    }])
    setDraft('')
    try {
      await sendMessageAction(formData)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível enviar a mensagem.')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
        <Link href={path.split('/').slice(0, -1).join('/')} className="lg:hidden p-1 -ml-1 text-gray-400 hover:text-gray-600" aria-label="Voltar">
          <ChevronLeft size={20} />
        </Link>
        <span className="shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
          {otherName.charAt(0).toUpperCase()}
        </span>
        <h3 className="text-sm font-semibold text-gray-800 truncate">{otherName}</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {localMessages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">Nenhuma mensagem ainda. Diga oi!</p>
        )}
        {localMessages.map(m => (
          <MessageBubble
            key={m.id}
            message={m}
            isOwn={m.authorId === currentUserId}
            currentUserId={currentUserId}
            path={path}
            toggleReactionAction={toggleReactionAction}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <form ref={formRef} action={submit} className="flex items-end gap-2 px-3 py-2.5 border-t border-gray-100 shrink-0">
        <input type="hidden" name="conversation_id" value={conversationId} />
        <input type="hidden" name="path" value={path} />
        <textarea
          name="content"
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

function MessageBubble({ message, isOwn, currentUserId, path, toggleReactionAction }: {
  message: ChatMessage
  isOwn: boolean
  currentUserId: string
  path: string
  toggleReactionAction: (formData: FormData) => Promise<void>
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const sticker = isStickerContent(message.content)
  const time = new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
      {sticker ? (
        <span className="text-4xl leading-none px-1">{message.content}</span>
      ) : (
        <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isOwn ? 'bg-brand-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-0.5 px-1">
        <span className="text-[10px] text-gray-400">{time}</span>
        <div className="relative opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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
              <div className="absolute bottom-full mb-1 left-0 z-20 flex items-center gap-0.5 bg-white border border-gray-200 rounded-full shadow-lg px-1.5 py-1">
                {REACTION_EMOJIS.map(emoji => (
                  <form key={emoji} action={toggleReactionAction} onSubmit={() => setPickerOpen(false)}>
                    <input type="hidden" name="message_id" value={message.id} />
                    <input type="hidden" name="emoji" value={emoji} />
                    <input type="hidden" name="path" value={path} />
                    <button type="submit" className="text-base leading-none p-1 rounded-full hover:bg-gray-100">{emoji}</button>
                  </form>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {message.reactions.length > 0 && (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {message.reactions.map(r => (
            <form key={r.emoji} action={toggleReactionAction}>
              <input type="hidden" name="message_id" value={message.id} />
              <input type="hidden" name="emoji" value={r.emoji} />
              <input type="hidden" name="path" value={path} />
              <button
                type="submit"
                className={`text-xs rounded-full px-1.5 py-0.5 border transition-colors ${r.userIds.includes(currentUserId) ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              >
                {r.emoji} {r.userIds.length}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  )
}
