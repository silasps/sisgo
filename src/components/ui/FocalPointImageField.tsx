'use client'

import { useRef, useState } from 'react'
import { ImageIcon, RotateCw, Trash2, CheckCircle2, Crosshair } from 'lucide-react'
import { FocalPointPickerModal } from './FocalPointPickerModal'

// Campo de imagem do anúncio: dropzone + ponto focal, sem crop de pixels
// (ver FocalPointPickerModal). `name="image"` vira 3 campos no FormData de
// quem usa este componente: `image` (o arquivo), `image_focal_x`/
// `image_focal_y` (0-100, sempre presentes) e `remove_image=1` só quando uma
// imagem já salva foi removida sem escolher uma nova.
export function FocalPointImageField({
  name, existingImageUrl, existingFocalX = 50, existingFocalY = 50,
}: {
  name: string
  existingImageUrl?: string | null
  existingFocalX?: number
  existingFocalY?: number
}) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [removedExisting, setRemovedExisting] = useState(false)
  const [focal, setFocal] = useState({ x: existingFocalX, y: existingFocalY })
  const [pickerOpen, setPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasExisting = !!existingImageUrl && !removedExisting && !file
  const displayUrl = previewUrl ?? (hasExisting ? existingImageUrl : null)
  const showingSomething = !!displayUrl

  function pickFile(f: File | null) {
    setFile(f)
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return f ? URL.createObjectURL(f) : null
    })
    if (f) {
      setRemovedExisting(false)
      if (inputRef.current) {
        const dt = new DataTransfer()
        dt.items.add(f)
        inputRef.current.files = dt.files
      }
      setFocal({ x: 50, y: 50 })
      setPickerOpen(true)
    } else if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  function handleRemove() {
    pickFile(null)
    if (existingImageUrl) setRemovedExisting(true)
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        onChange={e => pickFile(e.target.files?.[0] ?? null)}
        className="sr-only"
        id={`file-${name}`}
      />
      <input type="hidden" name={`${name}_focal_x`} value={focal.x} />
      <input type="hidden" name={`${name}_focal_y`} value={focal.y} />
      {removedExisting && <input type="hidden" name={`remove_${name}`} value="1" />}

      {showingSomething ? (
        <div className="flex items-center gap-3 bg-green-50/40 border border-green-200/80 rounded-xl px-3 py-2.5">
          <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-white border border-green-200/60 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview local ou pública do bucket, não passa pelo otimizador */}
            <img
              src={displayUrl!}
              alt=""
              className="w-full h-full object-cover"
              style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-800 flex items-center gap-1">
              <CheckCircle2 size={13} className="text-green-600 shrink-0" /> Imagem anexada
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-[11px] text-brand-600 hover:underline flex items-center gap-1 mt-0.5"
            >
              <Crosshair size={11} /> Ajustar ponto de destaque
            </button>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            title="Trocar"
            aria-label="Trocar imagem"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors shrink-0"
          >
            <RotateCw size={15} />
          </button>
          <button
            type="button"
            onClick={handleRemove}
            title="Remover"
            aria-label="Remover imagem"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <label
          htmlFor={`file-${name}`}
          className="group flex flex-col items-center justify-center w-full py-6 px-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer transition-all text-center hover:border-indigo-400 hover:bg-indigo-50/30"
        >
          <ImageIcon size={20} className="text-gray-300 group-hover:text-indigo-500 mb-1.5" />
          <span className="text-xs font-medium text-gray-700 group-hover:text-indigo-600">Clique ou arraste uma imagem</span>
          <span className="text-[10px] text-gray-400 mt-1">JPG, PNG ou WEBP — recomendado 1200×900px, até 10MB</span>
        </label>
      )}

      {pickerOpen && displayUrl && (
        <FocalPointPickerModal
          imageSrc={displayUrl}
          initialFocalX={focal.x}
          initialFocalY={focal.y}
          onCancel={() => setPickerOpen(false)}
          onConfirm={(x, y) => { setFocal({ x, y }); setPickerOpen(false) }}
        />
      )}
    </div>
  )
}
