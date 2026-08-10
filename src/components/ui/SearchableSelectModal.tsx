'use client'

import { useMemo, useState } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

export type SearchableOption = { id: string; label: string; sublabel?: string }

type Props = {
  name: string
  options: SearchableOption[]
  placeholder?: string
  searchPlaceholder?: string
  title?: string
  emptyLabel?: string
  defaultValue?: string
}

// Mesmo critério de busca tolerante usado no "Ver tudo" (AllAppsMenu): sem
// acento e aceita digitação incompleta/fora de ordem contígua (subsequência).
function normalize(s: string) {
  return s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase()
}

function matches(option: SearchableOption, query: string) {
  const nQuery = normalize(query)
  for (const field of [option.label, option.sublabel ?? '']) {
    const nField = normalize(field)
    if (nField.includes(nQuery)) return true
    let i = 0
    for (const ch of nField) {
      if (ch === nQuery[i]) i++
      if (i === nQuery.length) return true
    }
  }
  return false
}

export function SearchableSelectModal({
  name, options, placeholder = 'Selecionar usuário...', searchPlaceholder = 'Buscar por nome ou e-mail...',
  title = 'Selecionar usuário', emptyLabel = 'Nada encontrado.', defaultValue,
}: Props) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(defaultValue ?? '')
  const [query, setQuery] = useState('')

  const selected = options.find(o => o.id === selectedId)
  const q = query.trim()
  const filtered = useMemo(() => (q ? options.filter(o => matches(o, q)) : options), [options, q])

  return (
    <>
      <input type="hidden" name={name} value={selectedId} />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm text-left hover:border-brand-300 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        <span className={`truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} className="text-gray-400 shrink-0" />
      </button>

      <Modal open={open} onClose={() => { setOpen(false); setQuery('') }} title={title} hideFooter>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 min-w-0 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        <div className="divide-y divide-gray-50">
          {filtered.length > 0 ? filtered.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => { setSelectedId(o.id); setOpen(false); setQuery('') }}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-800 truncate">{o.label}</span>
                {o.sublabel && <span className="block text-xs text-gray-400 truncate">{o.sublabel}</span>}
              </span>
              {o.id === selectedId && <Check size={16} className="text-brand-500 shrink-0" />}
            </button>
          )) : (
            <p className="text-sm text-gray-400 text-center py-10">{emptyLabel}</p>
          )}
        </div>
      </Modal>
    </>
  )
}
