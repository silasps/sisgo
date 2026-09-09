'use client'

import { useRef, useState } from 'react'
import { FileText, RotateCw, Trash2 } from 'lucide-react'

// <input type="file"> nativo mostra "Escolher arquivo" / "Nenhum arquivo
// escolhido" no idioma do navegador/SO, não no idioma escolhido dentro do
// formulário — não dá pra traduzir isso via CSS/props. Esconde o input de
// verdade e usa um botão + texto próprios, traduzidos como qualquer outro
// campo do formulário.
//
// Mostra miniatura do que foi selecionado nesta sessão (via object URL) ou,
// se `existingFileUrl` for passado (URL assinada resolvida no servidor, já
// que o bucket é privado), do que já estava salvo de uma visita anterior —
// com botões de trocar (reabre o seletor) e remover. Remover um arquivo já
// salvo não apaga nada aqui: só marca um campo oculto (`remove_<name>`) que
// a Server Action decide o que fazer ao salvar a seção.
export function FileInputField({
  name, accept, required, chooseLabel, noFileLabel, tone = 'amber', onFileChange,
  existingFileUrl, existingFileName, existingFileType,
  changeLabel, removeLabel,
}: {
  name: string
  accept?: string
  required?: boolean
  chooseLabel: string
  noFileLabel: string
  tone?: 'amber' | 'indigo' | 'green'
  onFileChange?: (file: File | null) => void
  existingFileUrl?: string | null
  existingFileName?: string | null
  existingFileType?: string | null
  changeLabel?: string
  removeLabel?: string
}) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [removedExisting, setRemovedExisting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const toneClass = tone === 'amber'
    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
    : tone === 'green'
    ? 'bg-green-100 text-green-800 hover:bg-green-200'
    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'

  function pickFile(f: File | null) {
    setFile(f)
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null
    })
    if (f) setRemovedExisting(false)
    onFileChange?.(f)
  }

  function handleRemove() {
    if (inputRef.current) inputRef.current.value = ''
    pickFile(null)
    if (existingFileUrl) setRemovedExisting(true)
  }

  const hasExisting = !!existingFileUrl && !removedExisting && !file
  const showingSomething = !!file || hasExisting
  const displayName = file?.name ?? existingFileName ?? null
  const displayUrl = previewUrl ?? (hasExisting ? existingFileUrl : null)
  const isImage = file ? file.type.startsWith('image/') : (existingFileType?.startsWith('image/') ?? false)

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        required={required && !showingSomething}
        onChange={e => pickFile(e.target.files?.[0] ?? null)}
        className="sr-only"
        id={`file-${name}`}
      />
      {removedExisting && <input type="hidden" name={`remove_${name}`} value="1" />}

      {showingSomething ? (
        <div className="flex items-center gap-3 p-2 rounded-xl border border-gray-200 bg-gray-50">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-gray-200 flex items-center justify-center shrink-0">
            {displayUrl && isImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview local (object URL) ou assinada, não passa pelo otimizador
              <img src={displayUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <FileText size={20} className="text-gray-400" />
            )}
          </div>
          <span className="text-sm text-gray-600 truncate flex-1 min-w-0">{displayName}</span>
          <button type="button" onClick={() => inputRef.current?.click()}
            title={changeLabel} aria-label={changeLabel}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors shrink-0">
            <RotateCw size={16} />
          </button>
          <button type="button" onClick={handleRemove}
            title={removeLabel} aria-label={removeLabel}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0">
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <label
            htmlFor={`file-${name}`}
            className={`cursor-pointer text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${toneClass}`}
          >
            {chooseLabel}
          </label>
          <span className="text-sm text-gray-500 truncate">{noFileLabel}</span>
        </div>
      )}
    </div>
  )
}
