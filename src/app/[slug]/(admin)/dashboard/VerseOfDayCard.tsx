'use client'

import { useRef, useState } from 'react'
import { BookMarked, X } from 'lucide-react'
import type { VerseOfDay } from '@/lib/votd'

const DISMISS_THRESHOLD_PX = 80
const CLICK_SUPPRESS_PX = 6

/**
 * Card do versículo do dia — fecha por X ou arrastando pra esquerda, igual ao
 * AnnouncementCarousel (@/components/ui/AnnouncementCarousel). Estado só
 * local (sem localStorage): reaparece ao reabrir o app.
 */
export function VerseOfDayCard({ verse }: { verse: VerseOfDay }) {
  const [dismissed, setDismissed] = useState(false)
  const [dragDelta, setDragDelta] = useState(0)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const movedRef = useRef(0)

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    startXRef.current = e.clientX
    movedRef.current = 0
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const delta = e.clientX - startXRef.current
    movedRef.current = Math.max(movedRef.current, Math.abs(delta))
    setDragDelta(Math.min(0, delta)) // só arrasta visualmente pra esquerda
  }

  function handlePointerUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (dragDelta <= -DISMISS_THRESHOLD_PX) {
      setDismissed(true)
      return
    }
    setDragDelta(0)
  }

  function handleClick() {
    if (movedRef.current > CLICK_SUPPRESS_PX) return
    window.open(verse.youversionUrl, '_blank', 'noopener,noreferrer')
  }

  if (dismissed) return null

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => { if (e.key === 'Enter') handleClick() }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative flex items-start gap-3 rounded-xl bg-brand-50 p-4 pr-9 cursor-pointer select-none transition-colors hover:bg-brand-100"
      style={{
        transform: `translateX(${dragDelta}px)`,
        opacity: Math.max(0, 1 + dragDelta / 150),
        transition: draggingRef.current ? 'none' : 'transform 200ms ease, opacity 200ms ease',
        touchAction: 'pan-y',
      }}
    >
      <BookMarked className="size-5 shrink-0 text-brand-500 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm text-gray-700 italic">&ldquo;{verse.text}&rdquo;</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-600">{verse.reference}</p>
      </div>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setDismissed(true) }}
        aria-label="Fechar versículo do dia"
        className="absolute top-2 right-2 rounded-full p-1 text-brand-400 transition-colors hover:bg-brand-100 hover:text-brand-600"
      >
        <X size={14} />
      </button>
    </div>
  )
}
