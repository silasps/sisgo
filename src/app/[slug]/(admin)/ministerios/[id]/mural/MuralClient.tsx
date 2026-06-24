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
  { bg: 'bg-yellow-100', border: 'border-yellow-200', shadow: 'shadow-yellow-100/50', fold: 'bg-yellow-200/80' },
  { bg: 'bg-blue-100', border: 'border-blue-200', shadow: 'shadow-blue-100/50', fold: 'bg-blue-200/80' },
  { bg: 'bg-green-100', border: 'border-green-200', shadow: 'shadow-green-100/50', fold: 'bg-green-200/80' },
  { bg: 'bg-pink-100', border: 'border-pink-200', shadow: 'shadow-pink-100/50', fold: 'bg-pink-200/80' },
  { bg: 'bg-purple-100', border: 'border-purple-200', shadow: 'shadow-purple-100/50', fold: 'bg-purple-200/80' },
  { bg: 'bg-orange-100', border: 'border-orange-200', shadow: 'shadow-orange-100/50', fold: 'bg-orange-200/80' },
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
  const [showFontPicker, setShowFontPicker] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showSizePicker, setShowSizePicker] = useState(false)
  const [colorCounter, setColorCounter] = useState(nextColor)
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
    closePickers()

    const fd = new FormData()
    fd.set('content', content)
    fd.set('font', String(font))
    fd.set('text_color', String(textColor))
    fd.set('font_size', String(fontSize))

    startTransition(async () => {
      await postAction(fd)
    })
  }

  function handleDelete(messageId: string) {
    setLocalMessages(prev => prev.filter(m => m.id !== messageId))
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

  function closePickers() {
    setShowFontPicker(false)
    setShowColorPicker(false)
    setShowSizePicker(false)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
        {localMessages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📌</p>
            <p className="text-sm text-gray-400">Nenhuma anotação no mural ainda.</p>
            <p className="text-xs text-gray-300 mt-1">Escreva algo para a equipe!</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {localMessages.map((msg, i) => {
              const c = STICKER_COLORS[msg.color % STICKER_COLORS.length]
              const rot = ROTATIONS[i % ROTATIONS.length]
              const isOwn = msg.author_id === currentUserId
              const canRemove = isOwn || canDelete
              const fontClass = FONTS[msg.font % FONTS.length].class
              const colorClass = TEXT_COLORS[msg.text_color % TEXT_COLORS.length].class
              const isTemp = msg.id.startsWith('temp-')
              return (
                <div
                  key={msg.id}
                  className={`relative ${c.bg} ${c.border} border rounded-lg pl-4 pr-6 py-3 shadow-sm ${c.shadow} ${rot} transition-all duration-200 hover:rotate-0 hover:shadow-md group ${isTemp ? 'opacity-70' : ''}`}
                >
                  {/* Dobrinha no canto */}
                  <div className="absolute top-0 right-0 w-5 h-5 overflow-hidden">
                    <div className={`absolute -top-0.5 -right-0.5 w-7 h-7 ${c.fold} rotate-45 origin-bottom-left shadow-sm`} />
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-gray-700">{msg.author_name}</span>
                        <span className="text-[10px] text-gray-400">{timeAgo(msg.created_at)}</span>
                      </div>
                      <p className={`${colorClass} ${fontClass} ${FONT_SIZES[msg.font_size % FONT_SIZES.length].class} whitespace-pre-line leading-relaxed`}>
                        {renderContent(msg.content, members)}
                      </p>
                    </div>
                    {canRemove && !isTemp && (
                      <button
                        type="button"
                        onClick={() => handleDelete(msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-white/50"
                      >
                        <Trash2 size={13} />
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
      <div className="border-t border-gray-200 bg-white px-4 py-3 md:px-6">
        <div className="max-w-2xl mx-auto relative">
          {/* Mention autocomplete */}
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

          {/* Font picker */}
          {showFontPicker && (
            <div className="absolute bottom-full mb-1 left-0 bg-white rounded-lg border border-gray-200 shadow-lg z-10 p-1">
              {FONTS.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setFont(i); setShowFontPicker(false) }}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${font === i ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50'}`}
                >
                  <span className={`${f.class} text-base w-6 text-center`}>{f.label}</span>
                  <span className="text-xs text-gray-500">{f.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Color picker */}
          {showColorPicker && (
            <div className="absolute bottom-full mb-1 left-10 bg-white rounded-lg border border-gray-200 shadow-lg z-10 p-2">
              <div className="flex gap-1.5">
                {TEXT_COLORS.map((tc, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setTextColor(i); setShowColorPicker(false) }}
                    title={tc.name}
                    className={`w-7 h-7 rounded-full ${tc.swatch} transition-all ${textColor === i ? 'ring-2 ring-brand-400 ring-offset-2 scale-110' : 'hover:scale-110'}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Size picker */}
          {showSizePicker && (
            <div className="absolute bottom-full mb-1 left-20 bg-white rounded-lg border border-gray-200 shadow-lg z-10 p-1">
              {FONT_SIZES.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setFontSize(i); setShowSizePicker(false) }}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-md transition-colors ${fontSize === i ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50'}`}
                >
                  <span className={`${s.class} font-bold w-6 text-center`}>{s.label}</span>
                  <span className="text-xs text-gray-500">{s.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-1 mb-1.5">
            <button
              type="button"
              onClick={() => { setShowFontPicker(v => !v); setShowColorPicker(false); setShowSizePicker(false) }}
              title="Fonte"
              className={`p-1.5 rounded-lg transition-colors ${showFontPicker ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            >
              <Type size={15} />
            </button>
            <button
              type="button"
              onClick={() => { setShowColorPicker(v => !v); setShowFontPicker(false); setShowSizePicker(false) }}
              title="Cor do texto"
              className={`p-1.5 rounded-lg transition-colors ${showColorPicker ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            >
              <Palette size={15} />
            </button>
            <button
              type="button"
              onClick={() => { setShowSizePicker(v => !v); setShowFontPicker(false); setShowColorPicker(false) }}
              title="Tamanho"
              className={`p-1.5 rounded-lg transition-colors ${showSizePicker ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            >
              <ALargeSmall size={15} />
            </button>
            <div className="flex items-center gap-1.5 ml-1 text-[10px] text-gray-400">
              <span className={`${FONTS[font].class}`}>{FONTS[font].name}</span>
              <span>·</span>
              <span>{FONT_SIZES[fontSize].name}</span>
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${TEXT_COLORS[textColor].swatch}`} />
            </div>
          </div>

          {/* Input */}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => handleInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escreva no mural... use @ para mencionar"
                rows={1}
                className={`w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition-colors ${FONTS[font].class} ${TEXT_COLORS[textColor].class} ${FONT_SIZES[fontSize].class}`}
              />
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || isPending}
              className="shrink-0 rounded-xl bg-brand-500 p-2.5 text-white transition-colors hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
