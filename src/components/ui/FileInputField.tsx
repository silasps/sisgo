'use client'

import { useRef, useState } from 'react'
import { FileText, RotateCw, Trash2, CheckCircle2, Pencil } from 'lucide-react'
import { PhotoCropperModal } from './PhotoCropperModal'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// <input type="file"> nativo mostra "Escolher arquivo" / "Nenhum arquivo
// escolhido" no idioma do navegador/SO, não no idioma escolhido dentro do
// formulário — não dá pra traduzir isso via CSS/props. Esconde o input de
// verdade e usa uma dropzone + card próprios, traduzidos como qualquer
// outro campo do formulário.
//
// Card com ícone/título/badge (Obrigatório/Opcional) por documento — vira
// "Pronto" (verde, com miniatura) assim que tem arquivo, seja recém
// selecionado nesta sessão (object URL) ou já salvo de uma visita anterior
// (via `existingFileUrl`, uma URL assinada resolvida no servidor já que o
// bucket é privado). Botões de trocar (reabre o seletor) e remover.
// Remover um arquivo já salvo não apaga nada aqui: só marca um campo oculto
// (`remove_<name>`) que a Server Action decide o que fazer ao salvar a seção.
type CropOptions = {
  aspect: number
  title: string
  zoomLabel: string
  confirmLabel: string
  cancelLabel: string
  errorLabel: string
  editLabel: string
}

export function FileInputField({
  name, accept, required, tone = 'amber', onFileChange,
  title, subtitle, icon, badgeLabel, readyLabel,
  dropLabel, dropHint, attachedLabel,
  changeLabel, removeLabel, modelGraphic, crop,
  existingFileUrl, existingFileName, existingFileType, existingFileSize,
}: {
  name: string
  accept?: string
  required?: boolean
  tone?: 'amber' | 'indigo' | 'green'
  onFileChange?: (file: File | null) => void
  title: string
  subtitle?: string
  icon?: React.ReactNode
  badgeLabel: string
  readyLabel: string
  dropLabel: string
  dropHint?: string
  attachedLabel: string
  changeLabel: string
  removeLabel: string
  /** Ex.: um guia visual de enquadramento pra foto — só aparece antes de anexar. */
  modelGraphic?: React.ReactNode
  /** Quando definido, todo arquivo (novo ou já anexado) passa por recorte/zoom antes de valer — com um lápis pra reabrir o ajuste sem escolher o arquivo de novo. */
  crop?: CropOptions
  existingFileUrl?: string | null
  existingFileName?: string | null
  existingFileType?: string | null
  existingFileSize?: number | null
}) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [removedExisting, setRemovedExisting] = useState(false)
  const [cropSource, setCropSource] = useState<{ url: string; revoke: boolean; fileName: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toneText = tone === 'amber' ? 'text-amber-600' : tone === 'green' ? 'text-green-700' : 'text-indigo-600'
  const toneBg = tone === 'amber' ? 'bg-amber-50' : tone === 'green' ? 'bg-green-50' : 'bg-indigo-50'
  const toneBorderHover = tone === 'amber' ? 'hover:border-amber-400 hover:bg-amber-50/30' : tone === 'green' ? 'hover:border-green-400 hover:bg-green-50/30' : 'hover:border-indigo-400 hover:bg-indigo-50/30'

  // O <input type="file"> nativo é quem de fato viaja no FormData no
  // submit — depois de um recorte, o resultado só existe como File em
  // memória (não veio de uma seleção real do usuário), então precisa ser
  // sincronizado de volta pro input via DataTransfer. Sem isso, o card
  // mostraria a prévia recortada mas o envio real levaria a foto original
  // inteira, sem o recorte.
  function pickFile(f: File | null) {
    setFile(f)
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null
    })
    if (f) setRemovedExisting(false)
    if (inputRef.current) {
      if (f) {
        const dt = new DataTransfer()
        dt.items.add(f)
        inputRef.current.files = dt.files
      } else {
        inputRef.current.value = ''
      }
    }
    onFileChange?.(f)
  }

  function handleRemove() {
    pickFile(null)
    if (existingFileUrl) setRemovedExisting(true)
  }

  function handleSelected(f: File | null) {
    if (f && crop && f.type.startsWith('image/')) {
      setCropSource({ url: URL.createObjectURL(f), revoke: true, fileName: f.name })
      return
    }
    pickFile(f)
  }

  function handleEditCrop() {
    if (!crop || !displayUrl) return
    setCropSource({ url: displayUrl, revoke: false, fileName: displayName ?? `${name}.jpg` })
  }

  function handleConfirmCrop(croppedFile: File) {
    if (cropSource?.revoke) URL.revokeObjectURL(cropSource.url)
    setCropSource(null)
    pickFile(croppedFile)
  }

  function handleCancelCrop() {
    if (cropSource?.revoke) {
      URL.revokeObjectURL(cropSource.url)
      // Sem isso, cancelar e tentar escolher o mesmo arquivo de novo não
      // dispara onChange em alguns navegadores (o valor do input "não mudou").
      if (inputRef.current) inputRef.current.value = ''
    }
    setCropSource(null)
  }

  const hasExisting = !!existingFileUrl && !removedExisting && !file
  const showingSomething = !!file || hasExisting
  const displayName = file?.name ?? existingFileName ?? null
  const displaySize = file?.size ?? existingFileSize ?? null
  const displayUrl = previewUrl ?? (hasExisting ? existingFileUrl : null)
  const isImage = file ? file.type.startsWith('image/') : (existingFileType?.startsWith('image/') ?? false)

  return (
    <article className={`w-full min-w-0 rounded-2xl border p-4 transition-colors ${showingSomething ? 'border-green-200 bg-white' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-2.5 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${showingSomething ? 'bg-green-50 text-green-600' : `${toneBg} ${toneText}`}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{title}</h3>
            {showingSomething ? (
              <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} className="shrink-0" /> {attachedLabel}
              </p>
            ) : subtitle ? (
              <p className="text-xs text-gray-400 truncate">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded shrink-0 ${
          showingSomething
            ? 'bg-green-50 text-green-700 border border-green-200'
            : required ? `${toneBg} ${toneText} border border-current/20` : 'bg-gray-50 text-gray-400 border border-gray-200'
        }`}>
          {showingSomething ? readyLabel : badgeLabel}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        required={required && !showingSomething}
        onChange={e => handleSelected(e.target.files?.[0] ?? null)}
        className="sr-only"
        id={`file-${name}`}
      />
      {removedExisting && <input type="hidden" name={`remove_${name}`} value="1" />}

      {showingSomething ? (
        <div className="flex items-center gap-2.5 bg-green-50/40 border border-green-200/80 rounded-xl px-3 py-2.5">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-white border border-green-200/60 flex items-center justify-center shrink-0">
            {displayUrl && isImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview local (object URL) ou assinada, não passa pelo otimizador
              <img src={displayUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <FileText size={16} className="text-green-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-800 truncate">{displayName}</p>
            {displaySize != null && <p className="text-[10px] text-gray-400">{formatBytes(displaySize)}</p>}
          </div>
          {crop && isImage && displayUrl && (
            <button type="button" onClick={handleEditCrop}
              title={crop.editLabel} aria-label={crop.editLabel}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors shrink-0">
              <Pencil size={15} />
            </button>
          )}
          <button type="button" onClick={() => inputRef.current?.click()}
            title={changeLabel} aria-label={changeLabel}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors shrink-0">
            <RotateCw size={15} />
          </button>
          <button type="button" onClick={handleRemove}
            title={removeLabel} aria-label={removeLabel}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0">
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <>
          {modelGraphic}
          <label
            htmlFor={`file-${name}`}
            className={`group flex flex-col items-center justify-center w-full py-4 px-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer transition-all text-center ${toneBorderHover}`}
          >
            <span className={`text-xs font-medium text-gray-700 group-hover:${toneText}`}>{dropLabel}</span>
            {dropHint && <span className="text-[10px] text-gray-400 mt-1">{dropHint}</span>}
          </label>
        </>
      )}

      {crop && cropSource && (
        <PhotoCropperModal
          imageSrc={cropSource.url}
          aspect={crop.aspect}
          fileName={cropSource.fileName}
          tone={tone === 'green' ? 'amber' : tone}
          title={crop.title}
          zoomLabel={crop.zoomLabel}
          confirmLabel={crop.confirmLabel}
          cancelLabel={crop.cancelLabel}
          errorLabel={crop.errorLabel}
          onCancel={handleCancelCrop}
          onConfirm={handleConfirmCrop}
        />
      )}
    </article>
  )
}
