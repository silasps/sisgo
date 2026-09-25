'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, ZoomIn } from 'lucide-react'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
import { focalImageStyle } from '@/lib/image-focal'

function clampPct(v: number) {
  return Math.min(100, Math.max(0, Math.round(v)))
}

// Em vez de recortar pixels (como PhotoCropperModal/AvatarCropperModal),
// marca um ponto de destaque (0-100%, dois números) + um zoom (1x-3x) sobre
// a imagem inteira — o mesmo arquivo é reaproveitado em qualquer proporção
// via CSS `object-position`/`transform: scale`, sem gerar um recorte por
// formato. Por isso ajustar foco/zoom de uma imagem já salva não reenvia
// arquivo nenhum, só os três números. O zoom existe porque um ponto focal
// sozinho não evita cortar demais uma foto quadrada/vertical num espaço bem
// largo (o carrossel do banner de área) — ele só escolhe ONDE focar, não
// QUANTO aproximar antes. As mini-prévias usam `focalImageStyle`, a mesma
// função usada nos lugares reais do sistema, então mostram fielmente como o
// anúncio vai aparecer.
export function FocalPointPickerModal({
  imageSrc, initialFocalX = 50, initialFocalY = 50, initialZoom = 1, saving, onCancel, onConfirm,
}: {
  imageSrc: string
  initialFocalX?: number
  initialFocalY?: number
  /** 1 a 3 (1x a 3x) — mesma escala de zoom já usada em AvatarCropperModal. */
  initialZoom?: number
  saving?: boolean
  onCancel: () => void
  onConfirm: (focalX: number, focalY: number, zoom: number) => void
}) {
  const [focal, setFocal] = useState({ x: initialFocalX, y: initialFocalY })
  const [zoom, setZoom] = useState(initialZoom)
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

  const previewStyle = focalImageStyle(focal.x, focal.y, Math.round(zoom * 100))

  const modal = (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Ajustar ponto de destaque</h2>
        <p className="text-xs text-gray-400 mb-4">
          Clique ou arraste sobre a imagem para marcar o ponto mais importante, e use o zoom pra controlar o quanto aproximar antes — ele continua visível em qualquer formato de tela, sem precisar recortar a imagem de novo.
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
          {/* Imagem inteira sempre visível aqui (object-contain, sem zoom) —
              é a superfície de marcação, precisa mostrar tudo pra poder
              clicar em qualquer parte. O efeito do zoom só aparece nas
              mini-prévias abaixo, que são o que de fato será exibido. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL local ou pública do bucket, não passa pelo otimizador */}
          <img src={imageSrc} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <div
            className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white bg-brand-500/80 shadow-lg pointer-events-none"
            style={{ left: `${focal.x}%`, top: `${focal.y}%` }}
          />
        </div>

        <div className="flex items-center gap-3 mt-3">
          <ZoomIn size={15} className="text-gray-400 shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full accent-brand-500"
            aria-label="Zoom"
          />
        </div>

        <p className="text-xs font-medium text-gray-500 mt-4 mb-2">Como fica em cada lugar do sistema</p>
        <div className="grid grid-cols-2 gap-3">
          <PreviewBox label="Card compacto (listas)" ratio="4 / 3" imageSrc={imageSrc} style={previewStyle} />
          <PreviewBox label="Banner / modal de detalhes" ratio="16 / 9" imageSrc={imageSrc} style={previewStyle} />
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
            onClick={() => onConfirm(focal.x, focal.y, zoom)}
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

function PreviewBox({ label, ratio, imageSrc, style }: {
  label: string; ratio: string; imageSrc: string; style: React.CSSProperties
}) {
  return (
    <div>
      <div className="w-full rounded-lg overflow-hidden bg-gray-100 border border-gray-200" style={{ aspectRatio: ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt="" className="w-full h-full object-cover" style={style} />
      </div>
      <p className="text-[10px] text-gray-400 mt-1 text-center">{label}</p>
    </div>
  )
}
