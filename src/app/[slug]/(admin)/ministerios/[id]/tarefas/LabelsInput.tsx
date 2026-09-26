'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { labelColor } from './types'

// Campo de etiquetas como chips coloridos, não texto cru — digita e aperta
// Enter/vírgula pra virar uma etiqueta removível (X); Backspace com o campo
// vazio remove a última. Guarda tudo num único hidden input com vírgulas
// (`name={name}`), então o parsing no servidor (parseCardFields, em
// actions.ts) continua o mesmo, sem precisar mudar nada lá.
export function LabelsInput({ name, defaultValue }: { name: string; defaultValue?: string[] | null }) {
  const [labels, setLabels] = useState<string[]>(defaultValue ?? [])
  const [draft, setDraft] = useState('')

  function commit(raw: string) {
    const value = raw.trim().replace(/,+$/, '')
    if (!value) { setDraft(''); return }
    setLabels(prev => prev.some(l => l.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value])
    setDraft('')
  }

  function remove(label: string) {
    setLabels(prev => prev.filter(l => l !== label))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && draft === '' && labels.length > 0) {
      setLabels(prev => prev.slice(0, -1))
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={labels.join(',')} />
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 px-2 py-1.5 focus-within:ring-2 focus-within:ring-brand-400">
        {labels.map(label => (
          <span key={label} className={`inline-flex items-center gap-1 text-xs font-medium pl-2 pr-1 py-0.5 rounded-full ${labelColor(label)}`}>
            {label}
            <button
              type="button"
              onClick={() => remove(label)}
              aria-label={`Remover etiqueta ${label}`}
              className="hover:opacity-60 transition-opacity"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(draft)}
          placeholder={labels.length === 0 ? 'Digite e pressione Enter (opcional)' : 'Adicionar…'}
          className="flex-1 min-w-[8ch] text-sm outline-none py-0.5 bg-transparent"
        />
      </div>
    </div>
  )
}
