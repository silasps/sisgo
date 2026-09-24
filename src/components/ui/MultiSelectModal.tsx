'use client'

import { useMemo, useState } from 'react'
import { Search, Check, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type { SearchableOption } from '@/components/ui/SearchableSelectModal'

type Props = {
  name: string
  options: SearchableOption[]
  placeholder?: string
  searchPlaceholder?: string
  title?: string
  emptyLabel?: string
}

// Mesmo critério de busca tolerante do SearchableSelectModal (sem acento,
// aceita digitação fora de ordem).
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

// Seleção múltipla estilo "adicionar participantes ao grupo": busca, marca
// várias pessoas (ficam como chips removíveis), fecha o modal só quando
// terminar — daí um único submit do form adiciona todo mundo de uma vez.
// Cada id vira um <input type="hidden"> com o MESMO name, então o server
// action lê a lista inteira com formData.getAll(name).
export function MultiSelectModal({
  name, options, placeholder = 'Selecionar pessoas...', searchPlaceholder = 'Buscar por nome...',
  title = 'Selecionar pessoas', emptyLabel = 'Nada encontrado.',
}: Props) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState('')

  const selectedSet = new Set(selectedIds)
  const selectedOptions = selectedIds
    .map(id => options.find(o => o.id === id))
    .filter((o): o is SearchableOption => !!o)

  const q = query.trim()
  const filtered = useMemo(() => (q ? options.filter(o => matches(o, q)) : options), [options, q])

  function toggle(id: string) {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }
  function remove(id: string) {
    setSelectedIds(ids => ids.filter(x => x !== id))
  }

  return (
    <div>
      {selectedIds.map(id => <input key={id} type="hidden" name={name} value={id} />)}

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedOptions.map(o => (
            <span key={o.id} className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 text-xs font-medium pl-2.5 pr-1 py-1 rounded-full">
              {o.label}
              <button type="button" onClick={() => remove(o.id)} className="hover:bg-brand-100 rounded-full p-0.5 transition-colors">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm text-left hover:border-brand-300 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        <span className={`truncate ${selectedOptions.length ? 'text-gray-800' : 'text-gray-400'}`}>
          {selectedOptions.length > 0 ? `+ Adicionar mais...` : placeholder}
        </span>
        <Search size={15} className="text-gray-400 shrink-0" />
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
        <div className="divide-y divide-gray-50 max-h-[50vh] overflow-y-auto">
          {filtered.length > 0 ? filtered.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-800 truncate">{o.label}</span>
                {o.sublabel && <span className="block text-xs text-gray-400 truncate">{o.sublabel}</span>}
              </span>
              <span className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedSet.has(o.id) ? 'bg-brand-500 border-brand-500' : 'border-gray-300'}`}>
                {selectedSet.has(o.id) && <Check size={13} className="text-white" />}
              </span>
            </button>
          )) : (
            <p className="text-sm text-gray-400 text-center py-10">{emptyLabel}</p>
          )}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-3">
          <button
            type="button"
            onClick={() => { setOpen(false); setQuery('') }}
            className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {selectedOptions.length > 0 ? `Concluído (${selectedOptions.length} selecionado${selectedOptions.length === 1 ? '' : 's'})` : 'Fechar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
