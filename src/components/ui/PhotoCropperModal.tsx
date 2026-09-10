'use client'

import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { ZoomIn } from 'lucide-react'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'

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

  useBodyScrollLock()

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

  // Cabeçalho (h-14/56px) e rodapé (h-[172px], com altura fixa mesmo sem
  // erro pra nunca mudar de tamanho depois de montado) ficam com altura
  // constante, e a área de recorte no mobile é posicionada via top/bottom
  // absolutos batendo exatamente com essas alturas — o navegador resolve o
  // tamanho da área do meio numa única conta de layout (CSS puro), sem
  // depender de flexbox "sobrar espaço" pro filho dividir com a lib de
  // recorte nem de nenhuma medição em JS (essa combinação se mostrou
  // frágil na prática). No desktop (sm:) tudo volta a ficar em fluxo normal
  // (position: relative), empilhado como um cartão comum.
  return (
    <div className="fixed inset-0 z-[60] bg-black sm:bg-black/70 sm:flex sm:items-center sm:justify-center sm:p-4" onClick={onCancel}>
      <div
        className="relative w-full h-[100dvh] sm:h-auto sm:max-w-sm sm:max-h-[85dvh] sm:rounded-2xl sm:shadow-xl sm:overflow-hidden bg-black sm:bg-white mx-auto"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="absolute sm:relative top-0 sm:top-auto inset-x-0 sm:inset-x-auto z-10 h-14 flex items-center justify-between px-4 sm:px-5 border-b border-white/10 sm:border-gray-100 bg-black sm:bg-white"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <h3 className="font-semibold text-white sm:text-gray-900 text-sm">{title}</h3>
          <button type="button" onClick={onCancel} className="text-white/70 hover:text-white sm:text-gray-400 sm:hover:text-gray-700 text-xl leading-none px-1">×</button>
        </div>

        <div className="absolute sm:relative top-14 sm:top-auto bottom-[172px] sm:bottom-auto inset-x-0 sm:inset-x-auto sm:h-80 bg-gray-900">
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
          className="absolute sm:relative bottom-0 sm:bottom-auto inset-x-0 sm:inset-x-auto z-10 h-[172px] flex flex-col justify-center gap-3 px-4 sm:px-5 py-4 bg-black sm:bg-white"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center gap-3">
            <ZoomIn size={15} className="text-white/60 sm:text-gray-400 shrink-0" aria-hidden />
            <input type="range" min={1} max={3} step={0.02} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              aria-label={zoomLabel}
              className="w-full accent-current" style={{ color: accent }} />
          </div>
          <p className="text-xs text-red-400 sm:text-red-600 h-4">{error ? errorLabel : ''}</p>
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
