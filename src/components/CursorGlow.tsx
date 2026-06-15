'use client'
import { useEffect, useRef } from 'react'

export function CursorGlow() {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  const target   = useRef({ x: -2000, y: -2000 })
  const outerPos = useRef({ x: -2000, y: -2000 })
  const innerPos = useRef({ x: -2000, y: -2000 })
  const raf      = useRef<number | undefined>(undefined)
  const entered  = useRef(false)

  useEffect(() => {
    const place = (el: HTMLDivElement | null, x: number, y: number) => {
      if (el) el.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`
    }

    const onMove = (e: MouseEvent) => {
      // Na primeira entrada snapa para não deslizar do canto
      if (!entered.current) {
        entered.current = true
        outerPos.current = { x: e.clientX, y: e.clientY }
        innerPos.current = { x: e.clientX, y: e.clientY }
      }
      target.current = { x: e.clientX, y: e.clientY }
    }

    const tick = () => {
      // Outer: lag pesado — segue devagar, cria "sombra" de luz
      outerPos.current.x += (target.current.x - outerPos.current.x) * 0.045
      outerPos.current.y += (target.current.y - outerPos.current.y) * 0.045
      // Inner: mais ágil — o "núcleo" do spotlight
      innerPos.current.x += (target.current.x - innerPos.current.x) * 0.14
      innerPos.current.y += (target.current.y - innerPos.current.y) * 0.14

      place(outerRef.current, outerPos.current.x, outerPos.current.y)
      place(innerRef.current, innerPos.current.x, innerPos.current.y)

      raf.current = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    raf.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <>
      {/* Halo ambiente — grande, lento */}
      <div
        ref={outerRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-0 rounded-full"
        style={{
          width: '960px',
          height: '960px',
          willChange: 'transform',
          background:
            'radial-gradient(circle, rgba(29,107,103,0.11) 0%, rgba(29,107,103,0.05) 38%, transparent 68%)',
        }}
      />
      {/* Spotlight núcleo — menor, mais brilhante, mais rápido */}
      <div
        ref={innerRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-0 rounded-full"
        style={{
          width: '380px',
          height: '380px',
          willChange: 'transform',
          background:
            'radial-gradient(circle, rgba(29,107,103,0.32) 0%, rgba(29,107,103,0.14) 28%, rgba(29,107,103,0.04) 55%, transparent 72%)',
        }}
      />
    </>
  )
}
