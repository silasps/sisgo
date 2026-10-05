'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Check, X, Loader2 } from 'lucide-react'

type Props = {
  label: string
  value: string
  section: string
  fieldKey: string
  action: (formData: FormData) => Promise<{ error: string } | { ok: true }>
}

// Edição inline genérica pra qualquer campo solto do form_data — clique no
// lápis, edita, salva. Um componente só pra todos os ~50 campos em vez de um
// editor dedicado por campo (a maioria é texto/data/"sim"-"nao" mesmo).
export function EditableFormField({ label, value, section, fieldKey, action }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value === '—' ? '' : value)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSave() {
    const fd = new FormData()
    fd.append('section', section)
    fd.append('key', fieldKey)
    fd.append('value', draft)
    startTransition(async () => {
      const res = await action(fd)
      if ('error' in res) { toast.error(res.error); return }
      setEditing(false)
      router.refresh()
    })
  }

  if (!editing) {
    return (
      <div className="text-sm group">
        <p className="text-xs text-gray-400">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-gray-800">{value}</p>
          <button type="button" onClick={() => { setDraft(value === '—' ? '' : value); setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) }}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-brand-600 transition-opacity">
            <Pencil size={12} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-sm">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          disabled={isPending}
          className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button type="button" onClick={handleSave} disabled={isPending} className="text-green-600 hover:text-green-700 disabled:opacity-50">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={isPending} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
