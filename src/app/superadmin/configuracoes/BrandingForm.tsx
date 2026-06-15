'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ACCENT_COLORS, type AccentColorKey } from '@/lib/accent-colors'
import { updateSuperAdminAccentColor, updateSuperAdminLogoUrl } from './actions'

type Props = {
  currentLogoUrl: string | null
  currentAccentColor: string
}

export function BrandingForm({ currentLogoUrl, currentAccentColor }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedColor, setSelectedColor] = useState(currentAccentColor)
  const [logoPreview, setLogoPreview] = useState(currentLogoUrl)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'error'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleColorChange(colorKey: AccentColorKey) {
    setSelectedColor(colorKey)
    startTransition(async () => {
      await updateSuperAdminAccentColor(colorKey)
      router.refresh()
    })
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadStatus('uploading')
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `system/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (error) { setUploadStatus('error'); return }

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
    setLogoPreview(publicUrl)
    setUploadStatus('idle')

    startTransition(async () => {
      await updateSuperAdminLogoUrl(publicUrl)
      router.refresh()
    })
  }

  return (
    <div className="space-y-10 max-w-lg">

      <section>
        <h2 className="text-sm font-semibold text-white uppercase tracking-widest mb-4">Logo do Painel</h2>
        <div className="bg-dark-900 border border-dark-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-[110px] h-[38px] flex-shrink-0 bg-dark-950 rounded flex items-center justify-center overflow-hidden">
              {logoPreview ? (
                <Image src={logoPreview} alt="Logo" width={110} height={38} className="object-contain" unoptimized />
              ) : (
                <span className="text-xs text-gray-600">sem logo</span>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-300 font-medium">Prévia no menu</p>
              <p className="text-xs text-gray-500 mt-0.5">110 × 38 px</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Fundo transparente, texto/ícones brancos. PNG ou SVG, máx. 2 MB.</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadStatus === 'uploading'}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {uploadStatus === 'uploading' ? 'Enviando…' : 'Escolher arquivo'}
            </button>
            {uploadStatus === 'error' && <p className="text-xs text-red-400">Erro ao fazer upload.</p>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white uppercase tracking-widest mb-4">Cor de Destaque</h2>
        <div className="bg-dark-900 border border-dark-800 rounded-xl p-6">
          <p className="text-xs text-gray-500 mb-4">Aplicada nos botões e elementos de destaque do painel super admin.</p>
          <div className="grid grid-cols-4 gap-3">
            {(Object.entries(ACCENT_COLORS) as [AccentColorKey, typeof ACCENT_COLORS[AccentColorKey]][]).map(([key, color]) => {
              const isSelected = selectedColor === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleColorChange(key)}
                  disabled={isPending}
                  title={color.label}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                    isSelected ? 'border-white/40 bg-white/5' : 'border-transparent hover:border-white/20'
                  }`}
                >
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ backgroundColor: color.hex[500] }}>
                    {isSelected && '✓'}
                  </span>
                  <span className="text-xs text-gray-400">{color.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

    </div>
  )
}
