'use client'

import { useState, useRef, useEffect, useCallback, useTransition } from 'react'
import { Send, Trash2, Type, Palette, ALargeSmall } from 'lucide-react'

type Message = {
  id: string
  author_name: string
  author_id: string
  content: string
  mentions: string[]
  color: number
  font: number
  text_color: number
  font_size: number
  created_at: string
}

type Member = {
  person_id: string
  name: string
  user_id?: string | null
}

const STICKER_COLORS = [
  { bg: 'bg-yellow-100', border: 'border-yellow-200', shadow: 'shadow-yellow-100/50', fold: 'sticker-fold-yellow' },
  { bg: 'bg-blue-100', border: 'border-blue-200', shadow: 'shadow-blue-100/50', fold: 'sticker-fold-blue' },
  { bg: 'bg-green-100', border: 'border-green-200', shadow: 'shadow-green-100/50', fold: 'sticker-fold-green' },
  { bg: 'bg-pink-100', border: 'border-pink-200', shadow: 'shadow-pink-100/50', fold: 'sticker-fold-pink' },
  { bg: 'bg-purple-100', border: 'border-purple-200', shadow: 'shadow-purple-100/50', fold: 'sticker-fold-purple' },
  { bg: 'bg-orange-100', border: 'border-orange-200', shadow: 'shadow-orange-100/50', fold: 'sticker-fold-orange' },
]

const ROTATIONS = [
  '-rotate-[0.8deg]',
  'rotate-[0.6deg]',
  '-rotate-[0.4deg]',
  'rotate-[1deg]',
  '-rotate-[0.3deg]',
  'rotate-[0.5deg]',
]

const FONTS = [
  { label: 'Aa', class: 'font-sans', name: 'Normal' },
  { label: 'Aa', class: 'font-handwriting', name: 'Manuscrito' },
  { label: 'Aa', class: 'font-cursive', name: 'Cursiva' },
]

const FONT_SIZES = [
  { label: 'P', class: 'text-sm', name: 'Pequeno' },
  { label: 'M', class: 'text-base', name: 'Médio' },
  { label: 'G', class: 'text-lg', name: 'Grande' },
  { label: 'GG', class: 'text-xl', name: 'Extra grande' },
]

const TEXT_COLORS = [
  { class: 'text-gray-800', swatch: 'bg-gray-800', name: 'Escuro' },
  { class: 'text-blue-900', swatch: 'bg-blue-900', name: 'Azul' },
  { class: 'text-red-800', swatch: 'bg-red-800', name: 'Vermelho' },
  { class: 'text-green-900', swatch: 'bg-green-900', name: 'Verde' },
  { class: 'text-purple-900', swatch: 'bg-purple-900', name: 'Roxo' },
  { class: 'text-amber-900', swatch: 'bg-amber-900', name: 'Âmbar' },
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
  currentUserName: string
  canDelete: boolean
  nextColor: number
  postAction: (fd: FormData) => Promise<void>
  deleteAction: (fd: FormData) => Promise<void>
}

export function MuralClient({ messages: serverMessages, members, currentUserId, currentUserName, canDelete, nextColor, postAction, deleteAction }: Props) {
  const [localMessages, setLocalMessages] = useState<Message[]>(serverMessages)
  const [text, setText] = useState('')
  const [font, setFont] = useState(0)
  const [textColor, setTextColor] = useState(0)
  const [fontSize, setFontSize] = useState(1)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [showToolbar, setShowToolbar] = useState(false)
  const [colorCounter, setColorCounter] = useState(nextColor)
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalMessages(serverMessages)
  }, [serverMessages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [localMessages.length])

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
      if (text.trim()) handleSubmit()
    }
  }

  function handleSubmit() {
    const content = text.trim()
    if (!content) return

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      author_name: currentUserName,
      author_id: currentUserId,
      content,
      mentions: [],
      color: colorCounter,
      font,
      text_color: textColor,
      font_size: fontSize,
      created_at: new Date().toISOString(),
    }

    setLocalMessages(prev => [...prev, optimisticMsg])
    setColorCounter(c => (c + 1) % STICKER_COLORS.length)
    setText('')
    setShowToolbar(false)

    const fd = new FormData()
    fd.set('content', content)
    fd.set('color', String(colorCounter))
    fd.set('font', String(font))
    fd.set('text_color', String(textColor))
    fd.set('font_size', String(fontSize))

    startTransition(async () => {
      await postAction(fd)
    })
  }

  function handleDelete(messageId: string) {
    setLocalMessages(prev => prev.filter(m => m.id !== messageId))
    setExpandedMsg(null)
    const fd = new FormData()
    fd.set('message_id', messageId)
    startTransition(async () => {
      await deleteAction(fd)
    })
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-6 space-y-2.5 md:space-y-3">
        {localMessages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📌</p>
            <p className="text-sm text-gray-400">Nenhuma anotação no mural ainda.</p>
            <p className="text-xs text-gray-300 mt-1">Escreva algo para a equipe!</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-2.5 md:space-y-3">
            {localMessages.map((msg, i) => {
              const c = STICKER_COLORS[msg.color % STICKER_COLORS.length]
              const rot = ROTATIONS[i % ROTATIONS.length]
              const isOwn = msg.author_id === currentUserId
              const canRemove = isOwn || canDelete
              const fontClass = FONTS[msg.font % FONTS.length].class
              const colorClass = TEXT_COLORS[msg.text_color % TEXT_COLORS.length].class
              const isTemp = msg.id.startsWith('temp-')
              const isExpanded = expandedMsg === msg.id
              return (
                <div
                  key={msg.id}
                  className={`relative ${c.bg} ${c.border} border rounded-lg px-3.5 md:pl-4 md:pr-6 py-2.5 md:py-3 shadow-sm ${c.shadow} ${rot} ${c.fold} transition-all duration-200 hover:rotate-0 hover:shadow-md group ${isTemp ? 'opacity-70' : ''}`}
                  onClick={() => canRemove && !isTemp && setExpandedMsg(isExpanded ? null : msg.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-1.5">
                        <span className="text-[11px] md:text-xs font-bold text-gray-700 truncate">{msg.author_name}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(msg.created_at)}</span>
                      </div>
                      <p className={`${colorClass} ${fontClass} ${FONT_SIZES[msg.font_size % FONT_SIZES.length].class} whitespace-pre-line leading-relaxed`}>
                        {renderContent(msg.content, members)}
                      </p>
                    </div>
                    {canRemove && !isTemp && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleDelete(msg.id) }}
                        className={`shrink-0 p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-white/50 transition-all ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 bg-white px-3 py-2.5 md:px-6 md:py-3 safe-area-bottom">
        <div className="max-w-2xl mx-auto relative">
          {/* Mention autocomplete */}
          {showMentions && filteredMembers.length > 0 && (
            <div className="absolute bottom-full mb-1 left-0 right-0 bg-white rounded-lg border border-gray-200 shadow-lg max-h-40 overflow-y-auto z-10">
              {filteredMembers.slice(0, 6).map(m => (
                <button
                  key={m.person_id}
                  type="button"
                  onClick={() => insertMention(m.name)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-brand-50 transition-colors truncate active:bg-brand-100"
                >
                  <span className="text-brand-600 font-medium">@</span>{m.name}
                </button>
              ))}
            </div>
          )}

          {/* Formatting toolbar (toggle) */}
          {showToolbar && (
            <div className="absolute bottom-full mb-1 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-lg z-10 p-3">
              <div className="space-y-3">
                {/* Fonte */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Fonte</p>
                  <div className="flex gap-1">
                    {FONTS.map((f, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setFont(i)}
                        className={`flex-1 px-2 py-2 text-xs rounded-lg transition-colors text-center ${font === i ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                      >
                        <span className={`${f.class} block text-sm`}>{f.label}</span>
                        <span className="block text-[10px] mt-0.5">{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Tamanho */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Tamanho</p>
                  <div className="flex gap-1">
                    {FONT_SIZES.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setFontSize(i)}
                        className={`flex-1 px-2 py-2 text-xs rounded-lg transition-colors text-center ${fontSize === i ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                      >
                        <span className="block font-bold">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Cor */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Cor</p>
                  <div className="flex gap-2">
                    {TEXT_COLORS.map((tc, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setTextColor(i)}
                        title={tc.name}
                        className={`w-8 h-8 rounded-full ${tc.swatch} transition-all ${textColor === i ? 'ring-2 ring-brand-400 ring-offset-2 scale-110' : 'hover:scale-110'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setShowToolbar(v => !v)}
              title="Formatação"
              className={`shrink-0 p-2.5 rounded-xl transition-colors ${showToolbar ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            >
              <Type size={18} />
            </button>
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => handleInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowToolbar(false)}
                placeholder="Escreva no mural..."
                rows={1}
                className={`w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition-colors ${FONTS[font].class} ${TEXT_COLORS[textColor].class} ${FONT_SIZES[fontSize].class}`}
              />
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || isPending}
              className="shrink-0 rounded-xl bg-brand-500 p-2.5 text-white transition-colors hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400 active:bg-brand-700"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
