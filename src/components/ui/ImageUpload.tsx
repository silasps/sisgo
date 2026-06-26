'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  name: string
  defaultUrl?: string | null
  label?: string
  bucket?: string
  folder?: string
}

async function convertToWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas context')); return }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('conversion failed')),
        'image/webp',
        0.85
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })
}

export function ImageUpload({ name, defaultUrl, label = 'Imagem', bucket = 'school-media', folder = 'programs' }: Props) {
  const [preview, setPreview] = useState<string | null>(defaultUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publicUrl, setPublicUrl] = useState<string>(defaultUrl ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const webpBlob = await convertToWebP(file)
      const fileName = `${folder}/${Date.now()}.webp`

      const supabase = createClient()

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, webpBlob, { contentType: 'image/webp', upsert: false })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
      setPublicUrl(data.publicUrl)
      setPreview(data.publicUrl)
    } catch (err) {
      setError('Erro ao enviar imagem. Tente novamente.')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>

      <div
        onClick={() => inputRef.current?.click()}
        className="relative cursor-pointer rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-400 transition-colors overflow-hidden bg-gray-50 group"
        style={{ minHeight: 120 }}
      >
        {preview ? (
          <>
            <img src={preview} alt="preview" className="w-full h-40 object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-sm font-semibold">Trocar imagem</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-28 gap-2 text-gray-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">Clique para escolher uma imagem</span>
            <span className="text-xs text-gray-300">Convertida automaticamente para WebP</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Convertendo e enviando…
            </div>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <input type="hidden" name={name} value={publicUrl} />

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
