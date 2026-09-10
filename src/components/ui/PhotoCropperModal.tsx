'use client'

import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { ZoomIn } from 'lucide-react'

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Necessário pra recortar uma foto já salva (URL assinada do Supabase,
    // origem diferente) sem "sujar" o canvas — sem isso toBlob() falha
    // silenciosamente pra imagem remota. Object URL de arquivo recém
    // escolhido (mesma origem) não é afetado por isso.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'))
    img.src = url
  })
}

async function cropToFile(imageSrc: string, area: Area, fileName: string): Promise<File> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width)
  canvas.height = Math.round(area.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível.')
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Não foi possível recortar a imagem.')); return }
      resolve(new File([blob], fileName, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  })
}

// Recorte/zoom da foto pessoal antes (ou depois) de anexar — grade de
// enquadramento, arrastar pra reposicionar, roda/pinça pra zoom, como em
// qualquer editor de foto de perfil (Instagram etc). O resultado final é
// sempre um JPEG já recortado no formato pedido — quem chama não precisa
// se preocupar com o tamanho/proporção original da foto escolhida.
export function PhotoCropperModal({
  imageSrc, aspect, fileName, tone = 'amber',
  title, zoomLabel, confirmLabel, cancelLabel, errorLabel,
  onCancel, onConfirm,
}: {
  imageSrc: string
  aspect: number
  fileName: string
  tone?: 'amber' | 'indigo'
  title: string
  zoomLabel: string
  confirmLabel: string
  cancelLabel: string
  errorLabel: string
  onCancel: () => void
  onConfirm: (file: File) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const accent = tone === 'amber' ? '#d97706' : '#4f46e5'

  const onCropComplete = useCallback((_: Area, pixels: Area) => setCroppedAreaPixels(pixels), [])

  async function handleConfirm() {
    if (!croppedAreaPixels) return
    setSaving(true)
    setError(false)
    try {
      const file = await cropToFile(imageSrc, croppedAreaPixels, fileName)
      onConfirm(file)
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  return (
    // Centralizar um modal com fixed+items-center depende de bater 100vh
    // com a altura realmente visível — no mobile isso é frágil (barra de
    // endereço do navegador, teclado, etc.) e o modal pode calcular o
    // centro pra uma área maior do que a pessoa realmente vê. A solução que
    // apps de foto maduros usam (Instagram, Google Fotos) não tenta
    // resolver essa conta: no mobile o editor vira tela cheia — cabeçalho e
    // rodapé fixos, a área de recorte ocupa (flex-1) o que sobrar entre os
    // dois, sem centralizar nada. Sem cálculo de altura pra dar errado.
    // No desktop, sem esse problema de viewport, volta a ser um cartão
    // centralizado normal (sm:).
    <div className="fixed inset-0 z-[60] bg-black sm:bg-black/70 flex sm:items-center sm:justify-center sm:p-4" onClick={onCancel}>
      <div
        className="flex flex-col w-full h-full sm:h-auto sm:max-w-sm sm:max-h-[85dvh] sm:rounded-2xl sm:shadow-xl bg-black sm:bg-white overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-white/10 sm:border-gray-100 shrink-0"
          style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}
        >
          <h3 className="font-semibold text-white sm:text-gray-900 text-sm">{title}</h3>
          <button type="button" onClick={onCancel} className="text-white/70 hover:text-white sm:text-gray-400 sm:hover:text-gray-700 text-xl leading-none px-1">×</button>
        </div>

        <div className="relative bg-gray-900 flex-1 min-h-0 sm:flex-none sm:h-80">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div
          className="px-4 sm:px-5 py-4 space-y-3 shrink-0 bg-black sm:bg-white"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-3">
            <ZoomIn size={15} className="text-white/60 sm:text-gray-400 shrink-0" aria-hidden />
            <input type="range" min={1} max={3} step={0.02} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              aria-label={zoomLabel}
              className="w-full accent-current" style={{ color: accent }} />
          </div>
          {error && <p className="text-xs text-red-400 sm:text-red-600">{errorLabel}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white/80 sm:text-gray-600 border border-white/20 sm:border-gray-200 rounded-xl hover:bg-white/10 sm:hover:bg-gray-50 transition-colors">
              {cancelLabel}
            </button>
            <button type="button" onClick={handleConfirm} disabled={saving || !croppedAreaPixels}
              className="flex-1 px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-colors disabled:opacity-60"
              style={{ backgroundColor: accent }}>
              {saving ? '…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
