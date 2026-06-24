'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Trash2, X } from 'lucide-react'

type Message = {
  id: string
  author_name: string
  author_id: string
  content: string
  mentions: string[]
  color: number
  created_at: string
}

type Member = {
  person_id: string
  name: string
  user_id?: string | null
}

const STICKER_COLORS = [
  { bg: 'bg-yellow-100', border: 'border-yellow-200', shadow: 'shadow-yellow-100/50' },
  { bg: 'bg-blue-100', border: 'border-blue-200', shadow: 'shadow-blue-100/50' },
  { bg: 'bg-green-100', border: 'border-green-200', shadow: 'shadow-green-100/50' },
  { bg: 'bg-pink-100', border: 'border-pink-200', shadow: 'shadow-pink-100/50' },
  { bg: 'bg-purple-100', border: 'border-purple-200', shadow: 'shadow-purple-100/50' },
  { bg: 'bg-orange-100', border: 'border-orange-200', shadow: 'shadow-orange-100/50' },
]

const ROTATIONS = [
  '-rotate-[0.8deg]',
  'rotate-[0.6deg]',
  '-rotate-[0.4deg]',
  'rotate-[1deg]',
  '-rotate-[0.3deg]',
  'rotate-[0.5deg]',
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function renderContent(content: string, members: Member[]) {
  const parts = content.split(/(@\w[\w\s]*?)(?=\s@|\s*$|[.,!?])/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const name = part.slice(1).trim()
      const found = members.some(m => m.name.toLowerCase().startsWith(name.toLowerCase()))
      if (found) {
        return <span key={i} className="font-semibold text-brand-700 bg-brand-50 px-1 rounded">{part}</span>
      }
    }
    return <span key={i}>{part}</span>
  })
}

type Props = {
  messages: Message[]
  members: Member[]
  currentUserId: string
  canDelete: boolean
  postAction: (fd: FormData) => Promise<void>
  deleteAction: (fd: FormData) => Promise<void>
}

export function MuralClient({ messages, members, currentUserId, canDelete, postAction, deleteAction }: Props) {
  const [text, setText] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const filteredMembers = mentionFilter
    ? members.filter(m => m.name.toLowerCase().includes(mentionFilter.toLowerCase()))
    : members

  const handleInput = useCallback((value: string) => {
    setText(value)
    const lastAt = value.lastIndexOf('@')
    if (lastAt >= 0 && lastAt === value.length - 1) {
      setShowMentions(true)
      setMentionFilter('')
    } else if (lastAt >= 0) {
      const afterAt = value.slice(lastAt + 1)
      if (!afterAt.includes(' ') || afterAt.split(' ').length <= 2) {
        setShowMentions(true)
        setMentionFilter(afterAt)
      } else {
        setShowMentions(false)
      }
    } else {
      setShowMentions(false)
    }
  }, [])

  function insertMention(name: string) {
    const lastAt = text.lastIndexOf('@')
    const before = text.slice(0, lastAt)
    const newText = `${before}@${name} `
    setText(newText)
    setShowMentions(false)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (text.trim()) formRef.current?.requestSubmit()
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [text])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📌</p>
            <p className="text-sm text-gray-400">Nenhuma anotação no mural ainda.</p>
            <p className="text-xs text-gray-300 mt-1">Escreva algo para a equipe!</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {messages.map((msg, i) => {
              const c = STICKER_COLORS[msg.color % STICKER_COLORS.length]
              const rot = ROTATIONS[i % ROTATIONS.length]
              const isOwn = msg.author_id === currentUserId
              const canRemove = isOwn || canDelete
              return (
                <div
                  key={msg.id}
                  className={`${c.bg} ${c.border} border rounded-lg px-4 py-3 shadow-sm ${c.shadow} ${rot} transition-all duration-200 hover:rotate-0 hover:shadow-md group`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-gray-700">{msg.author_name}</span>
                        <span className="text-[10px] text-gray-400">{timeAgo(msg.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                        {renderContent(msg.content, members)}
                      </p>
                    </div>
                    {canRemove && (
                      <form action={deleteAction} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <input type="hidden" name="message_id" value={msg.id} />
                        <button type="submit" className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-white/50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 md:px-6">
        <div className="max-w-2xl mx-auto relative">
          {showMentions && filteredMembers.length > 0 && (
            <div className="absolute bottom-full mb-1 left-0 right-0 bg-white rounded-lg border border-gray-200 shadow-lg max-h-40 overflow-y-auto z-10">
              {filteredMembers.slice(0, 8).map(m => (
                <button
                  key={m.person_id}
                  type="button"
                  onClick={() => insertMention(m.name)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 transition-colors truncate"
                >
                  <span className="text-brand-600 font-medium">@</span>{m.name}
                </button>
              ))}
            </div>
          )}
          <form ref={formRef} action={postAction} onSubmit={() => setText('')} className="flex items-end gap-2">
            <input type="hidden" name="content" value={text} />
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => handleInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escreva no mural... use @ para mencionar"
                rows={1}
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={!text.trim()}
              className="shrink-0 rounded-xl bg-brand-500 p-2.5 text-white transition-colors hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
