'use client'

import { useRef, useState } from 'react'

// <input type="file"> nativo mostra "Escolher arquivo" / "Nenhum arquivo
// escolhido" no idioma do navegador/SO, não no idioma escolhido dentro do
// formulário — não dá pra traduzir isso via CSS/props. Esconde o input de
// verdade e usa um botão + texto próprios, traduzidos como qualquer outro
// campo do formulário.
export function FileInputField({
  name, accept, required, chooseLabel, noFileLabel, tone = 'amber', onFileChange,
}: {
  name: string
  accept?: string
  required?: boolean
  chooseLabel: string
  noFileLabel: string
  tone?: 'amber' | 'indigo' | 'green'
  onFileChange?: (file: File | null) => void
}) {
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toneClass = tone === 'amber'
    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
    : tone === 'green'
    ? 'bg-green-100 text-green-800 hover:bg-green-200'
    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        required={required}
        onChange={e => {
          const file = e.target.files?.[0] ?? null
          setFileName(file?.name ?? null)
          onFileChange?.(file)
        }}
        className="sr-only"
        id={`file-${name}`}
      />
      <label
        htmlFor={`file-${name}`}
        className={`cursor-pointer text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${toneClass}`}
      >
        {chooseLabel}
      </label>
      <span className="text-sm text-gray-500 truncate">{fileName ?? noFileLabel}</span>
    </div>
  )
}
