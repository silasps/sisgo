'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'

function clampPct(v: number) {
  return Math.min(100, Math.max(0, Math.round(v)))
}

// Em vez de recortar pixels (como PhotoCropperModal/AvatarCropperModal),
// marca só um ponto de destaque (0-100%, dois números) sobre a imagem
// inteira — o mesmo arquivo é reaproveitado em qualquer proporção via CSS
// `object-position`, sem gerar um recorte por formato. Por isso ajustar o
// foco de uma imagem já salva não passa arquivo nenhum de novo, só os dois
// números. As mini-prévias ao lado usam exatamente esse mecanismo, então
// mostram fielmente como o anúncio aparece em cada lugar do sistema.
export function FocalPointPickerModal({
  imageSrc, initialFocalX = 50, initialFocalY = 50, saving, onCancel, onConfirm,
}: {
  imageSrc: string
  initialFocalX?: number
  initialFocalY?: number
  saving?: boolean
  onCancel: () => void
  onConfirm: (focalX: number, focalY: number) => void
}) {
  const [focal, setFocal] = useState({ x: initialFocalX, y: initialFocalY })
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  useBodyScrollLock()

  function updateFromPoint(clientX: number, clientY: number) {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    setFocal({
      x: clampPct(((clientX - rect.left) / rect.width) * 100),
      y: clampPct(((clientY - rect.top) / rect.height) * 100),
    })
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    updateFromPoint(e.clientX, e.clientY)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return
    updateFromPoint(e.clientX, e.clientY)
  }

  function handlePointerUp() {
    draggingRef.current = false
  }

  const objectPosition = `${focal.x}% ${focal.y}%`

  const modal = (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Ajustar ponto de destaque</h2>
        <p className="text-xs text-gray-400 mb-4">
          Clique ou arraste sobre a imagem para marcar o ponto mais importante — ele continua visível em qualquer formato de tela, sem precisar recortar a imagem de novo.
        </p>

        <div
          ref={containerRef}
          className="relative w-full rounded-xl overflow-hidden bg-gray-900 cursor-crosshair touch-none select-none"
          style={{ aspectRatio: '4 / 3' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL local ou pública do bucket, não passa pelo otimizador */}
          <img src={imageSrc} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <div
            className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white bg-brand-500/80 shadow-lg pointer-events-none"
            style={{ left: `${focal.x}%`, top: `${focal.y}%` }}
          />
        </div>

        <p className="text-xs font-medium text-gray-500 mt-4 mb-2">Como fica em cada lugar do sistema</p>
        <div className="grid grid-cols-3 gap-3">
          <PreviewBox label="Card do Início" ratio="4 / 3" imageSrc={imageSrc} objectPosition={objectPosition} />
          <PreviewBox label="Banner de área" ratio="21 / 9" imageSrc={imageSrc} objectPosition={objectPosition} />
          <PreviewBox label="Modal de detalhes" ratio="16 / 9" imageSrc={imageSrc} objectPosition={objectPosition} />
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
            onClick={() => onConfirm(focal.x, focal.y)}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Salvando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

function PreviewBox({ label, ratio, imageSrc, objectPosition }: {
  label: string; ratio: string; imageSrc: string; objectPosition: string
}) {
  return (
    <div>
      <div className="w-full rounded-lg overflow-hidden bg-gray-100 border border-gray-200" style={{ aspectRatio: ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt="" className="w-full h-full object-cover" style={{ objectPosition }} />
      </div>
      <p className="text-[10px] text-gray-400 mt-1 text-center">{label}</p>
    </div>
  )
}
