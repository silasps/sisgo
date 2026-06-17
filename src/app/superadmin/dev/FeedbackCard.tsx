'use client'

import { useState, useTransition } from 'react'
import { updateFeedbackStatus, deleteFeedback } from './actions'
import { Trash2 } from 'lucide-react'

type Status = 'novo' | 'em_andamento' | 'feito' | 'descartado'

type Feedback = {
  id: string
  page_path: string
  page_label: string | null
  suggestion: string
  created_at: string
  status: Status
}

const STATUS_OPTIONS: { value: Status; label: string; color: string }[] = [
  { value: 'novo',         label: 'Novo',          color: 'bg-blue-100 text-blue-700' },
  { value: 'em_andamento', label: 'Em andamento',  color: 'bg-amber-100 text-amber-700' },
  { value: 'feito',        label: 'Feito',          color: 'bg-green-100 text-green-700' },
  { value: 'descartado',   label: 'Descartado',     color: 'bg-gray-100 text-gray-500' },
]

export function FeedbackCard({ item }: { item: Feedback }) {
  const [pending, startTransition] = useTransition()
  const [showDelete, setShowDelete] = useState(false)

  const current = STATUS_OPTIONS.find(s => s.value === item.status) ?? STATUS_OPTIONS[0]
  const nextStatuses = STATUS_OPTIONS.filter(s => s.value !== item.status)

  function handleStatus(status: Status) {
    startTransition(() => { updateFeedbackStatus(item.id, status) })
  }

  function handleDelete() {
    startTransition(() => { deleteFeedback(item.id) })
  }

  const date = new Date(item.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  const time = new Date(item.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 space-y-3 shadow-sm transition-opacity ${pending ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${current.color}`}>
            {item.page_label || item.page_path.split('/').filter(Boolean).pop()}
          </span>
          <p className="text-xs text-gray-400 mt-1 truncate">{item.page_path}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">{date}</p>
          <p className="text-xs text-gray-300">{time}</p>
        </div>
      </div>

      {/* Sugestão */}
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{item.suggestion}</p>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-50">
        {nextStatuses.map(s => (
          <button
            key={s.value}
            onClick={() => handleStatus(s.value)}
            disabled={pending}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors hover:opacity-80 disabled:opacity-40 ${s.color} border-transparent`}
          >
            → {s.label}
          </button>
        ))}
        <button
          onClick={() => setShowDelete(v => !v)}
          disabled={pending}
          className="ml-auto text-xs text-gray-300 hover:text-red-400 transition-colors px-1"
          title="Excluir"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {showDelete && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <p className="text-xs text-red-600 flex-1">Excluir permanentemente?</p>
          <button onClick={() => setShowDelete(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
          <button onClick={handleDelete} className="text-xs font-bold text-red-600 hover:text-red-800">Excluir</button>
        </div>
      )}
    </div>
  )
}
