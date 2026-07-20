'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, ZoomIn } from 'lucide-react'

const PREVIEW_SIZE = 260
const OUTPUT_SIZE = 512

function clamp(value: number, max: number) {
  return Math.min(max, Math.max(-max, value))
}

export function AvatarCropperModal({
  file,
  saving,
  onCancel,
  onConfirm,
}: {
  file: File
  saving?: boolean
  onCancel: () => void
  onConfirm: (webpBlob: Blob) => void
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [natural, setNatural] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const baseScale = natural.width && natural.height ? PREVIEW_SIZE / Math.min(natural.width, natural.height) : 1
  const scaleFactor = baseScale * zoom
  const displayWidth = natural.width * scaleFactor
  const displayHeight = natural.height * scaleFactor
  const maxOffsetX = Math.max(0, (displayWidth - PREVIEW_SIZE) / 2)
  const maxOffsetY = Math.max(0, (displayHeight - PREVIEW_SIZE) / 2)

  useEffect(() => {
    setOffset(o => ({ x: clamp(o.x, maxOffsetX), y: clamp(o.y, maxOffsetY) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, natural.width, natural.height])

  function handleImgLoad() {
    const img = imgRef.current
    if (!img) return
    setNatural({ width: img.naturalWidth, height: img.naturalHeight })
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffsetX: offset.x, startOffsetY: offset.y }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset({
      x: clamp(dragRef.current.startOffsetX + dx, maxOffsetX),
      y: clamp(dragRef.current.startOffsetY + dy, maxOffsetY),
    })
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleConfirm() {
    const img = imgRef.current
    if (!img || !natural.width || !scaleFactor) return

    const sourceCropSize = PREVIEW_SIZE / scaleFactor
    const sourceCenterX = natural.width / 2 - offset.x / scaleFactor
    const sourceCenterY = natural.height / 2 - offset.y / scaleFactor

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(
      img,
      sourceCenterX - sourceCropSize / 2,
      sourceCenterY - sourceCropSize / 2,
      sourceCropSize,
      sourceCropSize,
      0, 0, OUTPUT_SIZE, OUTPUT_SIZE
    )
    canvas.toBlob(blob => { if (blob) onConfirm(blob) }, 'image/webp', 0.85)
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Ajustar foto</h2>
        <p className="text-xs text-gray-400 mb-4">Arraste a imagem para posicionar e use o zoom para ajustar o enquadramento.</p>

        <div
          className="relative mx-auto rounded-full overflow-hidden bg-gray-100 ring-4 ring-gray-50 cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {imgUrl && (
            <img
              ref={imgRef}
              src={imgUrl}
              alt=""
              onLoad={handleImgLoad}
              draggable={false}
              className="absolute top-1/2 left-1/2 max-w-none pointer-events-none"
              style={{
                width: displayWidth || undefined,
                height: displayHeight || undefined,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <ZoomIn size={14} className="text-gray-400 shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full accent-brand-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !natural.width}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar foto'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
