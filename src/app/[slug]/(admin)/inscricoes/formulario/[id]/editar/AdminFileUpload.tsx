'use client'

import { useRef, useState } from 'react'

export function AdminFileUpload({ label, currentName, onUpload }: {
  label: string
  currentName?: string | null
  onUpload: (formData: FormData) => Promise<{ error?: string; success?: boolean }>
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState<string | null>(currentName ?? null)
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
      setStatus('idle')
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 truncate">{fileName ?? 'Nenhum arquivo enviado'}</p>
        {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
      </div>
      <label className={`shrink-0 cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
        status === 'sending' ? 'bg-gray-100 text-gray-400 cursor-wait' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
      }`}>
        {status === 'sending' ? 'Enviando…' : fileName ? 'Substituir' : 'Anexar'}
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
  )
}
