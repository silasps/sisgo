'use client'

import { useRef, useState } from 'react'
import { FileText, X } from 'lucide-react'

export function AdminFileUpload({ label, currentName, currentUrl, currentType, onUpload }: {
  label: string
  currentName?: string | null
  currentUrl?: string | null
  currentType?: string | null
  onUpload: (formData: FormData) => Promise<{ error?: string; success?: boolean }>
}) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState<string | null>(currentName ?? null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null)
  const [previewIsImage, setPreviewIsImage] = useState(currentType?.startsWith('image/') ?? false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('sending')
    setError('')
    const fd = new FormData()
    fd.set('file', file)
    const result = await onUpload(fd)
    if (result?.error) {
      setError(result.error)
      setStatus('error')
    } else {
      setFileName(file.name)
      setPreviewUrl(URL.createObjectURL(file))
      setPreviewIsImage(file.type.startsWith('image/'))
      setStatus('idle')
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-left hover:border-brand-300 hover:bg-brand-50/40 transition-colors">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400 truncate">{fileName ?? 'Nenhum arquivo enviado'}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-brand-700">{fileName ? 'Ver' : 'Anexar'}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">{label}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="size-4" />
              </button>
            </div>

            {previewUrl ? (
              previewIsImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={label} className="w-full max-h-80 object-contain rounded-lg border border-gray-100 bg-gray-50" />
              ) : (
                <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <FileText className="size-5 shrink-0 text-gray-400" />
                  <span className="truncate">{fileName ?? 'Abrir arquivo'}</span>
                </a>
              )
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-10 text-gray-400">
                <FileText className="size-8" />
                <p className="text-xs">Nenhum arquivo anexado ainda</p>
              </div>
            )}

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

            <label className={`mt-4 flex items-center justify-center cursor-pointer text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors ${
              status === 'sending' ? 'bg-gray-100 text-gray-400 cursor-wait' : 'bg-brand-500 text-white hover:bg-brand-600'
            }`}>
              {status === 'sending' ? 'Enviando…' : previewUrl ? 'Substituir arquivo' : 'Anexar arquivo'}
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={handleChange}
                disabled={status === 'sending'}
              />
            </label>
          </div>
        </div>
      )}
    </>
  )
}
