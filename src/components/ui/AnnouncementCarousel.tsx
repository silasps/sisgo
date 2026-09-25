'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pin } from 'lucide-react'
import { AnnouncementDetailModal } from './AnnouncementDetailModal'
import { CATEGORY_STYLES } from '@/lib/announcement-categories'
import { focalImageStyle } from '@/lib/image-focal'
import type { AnnouncementListItem } from './AnnouncementList'

const AUTO_ADVANCE_MS = 6000
const DRAG_THRESHOLD_PX = 50
const CLICK_SUPPRESS_PX = 6

// Carrossel de anúncios em loop — mesma técnica do DestaqueBanner (grainUp/
// editora): track flex com `transform: translateX(...)`, arraste via Pointer
// Events, avanço automático que respeita `prefers-reduced-motion` e pausa em
// hover/drag. Ocupa sozinho o espaço que antes era o banner de área + lista
// de texto — kicker/título viram uma legenda fixa por cima da imagem (não
// deslizam com o slide), pra sempre indicar em qual ministério/escola a
// pessoa está, não importa qual anúncio está em exibição.
export function AnnouncementCarousel({ announcements, kicker, title }: {
  announcements: AnnouncementListItem[]
  kicker: string
  title: string
}) {
  const total = announcements.length
  const [current, setCurrent] = useState(0)
  const [dragDelta, setDragDelta] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const pausedRef = useRef(false)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const movedRef = useRef(0)

  useEffect(() => {
    if (total <= 1) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const timer = setInterval(() => {
      if (!pausedRef.current) setCurrent(c => (c + 1) % total)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [total])

  function goTo(i: number) {
    setCurrent(((i % total) + total) % total)
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (total <= 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    pausedRef.current = true
    startXRef.current = e.clientX
    movedRef.current = 0
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return
    const delta = e.clientX - startXRef.current
    movedRef.current = Math.max(movedRef.current, Math.abs(delta))
    setDragDelta(delta)
  }

  function handlePointerUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    pausedRef.current = false
    if (dragDelta < -DRAG_THRESHOLD_PX) goTo(current + 1)
    else if (dragDelta > DRAG_THRESHOLD_PX) goTo(current - 1)
    setDragDelta(0)
  }

  function handleSlideClick(id: string) {
    if (movedRef.current > CLICK_SUPPRESS_PX) return
    setOpenId(id)
  }

  const slidePercent = (current / total) * 100
  const opened = announcements.find(a => a.id === openId) ?? null

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden bg-gray-900 select-none touch-none"
      style={{ aspectRatio: '16 / 9', maxHeight: 420 }}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="flex h-full"
        style={{
          width: `${total * 100}%`,
          transform: `translateX(calc(-${slidePercent}% + ${dragDelta}px))`,
          transition: draggingRef.current ? 'none' : 'transform 500ms cubic-bezier(.25,.46,.45,.94)',
          willChange: 'transform',
        }}
      >
        {announcements.map(a => {
          const cat = CATEGORY_STYLES[a.category] ?? CATEGORY_STYLES.aviso
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => handleSlideClick(a.id)}
              className="relative h-full shrink-0 text-left overflow-hidden"
              style={{ width: `${100 / total}%` }}
            >
              {a.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- imagem pública do bucket, não passa pelo otimizador
                <img
                  src={a.image_url}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={focalImageStyle(a.image_focal_x, a.image_focal_y, a.image_zoom)}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-700" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 pr-12">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  {a.pinned && <Pin size={12} className="text-white shrink-0" />}
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${cat.className}`}>
                    {cat.label}
                  </span>
                </div>
                <p className="text-white text-sm sm:text-base font-semibold leading-snug line-clamp-2">{a.title}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Legenda fixa (não desliza com o track) — identifica o ministério/escola independente de qual anúncio está em exibição. */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/55 to-transparent pointer-events-none z-10" />
      <div className="absolute top-3 left-3 z-20 pointer-events-none">
        <p className="text-[10px] uppercase tracking-wide text-white/85">{kicker}</p>
        <p className="text-base font-bold text-white leading-tight">{title}</p>
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            aria-label="Anúncio anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            aria-label="Próximo anúncio"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {announcements.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir para o anúncio ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>
        </>
      )}

      {opened && <AnnouncementDetailModal announcement={opened} onClose={() => setOpenId(null)} />}
    </div>
  )
}
