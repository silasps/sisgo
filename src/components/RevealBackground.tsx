'use client'
import { useEffect, useRef, useState } from 'react'

const IMAGES = [
  { src: '/images/people-india.jpg',  pos: '48% 42%' },
  { src: '/images/people-africa.jpg', pos: '52% 38%' },
  { src: '/images/people-arab.jpg',   pos: '48% 40%' },
  { src: '/images/people-sea.jpg',    pos: '50% 43%' },
  { src: '/images/people-asia.jpg',   pos: '50% 40%' },
]

const MASK_SCALE    = 0.25
const BASE_R        = 160
const STROKE_STEP   = 10
const COVERAGE_GOAL = 0.85
const SAMPLE_GAP    = 4
const LERP          = 0.18
const MASK_EVERY    = 3
const COVERAGE_TICK = 60

export function RevealBackground() {
  const curRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const [next,    setNext]    = useState(1)

  useEffect(() => {
    const curEl = curRef.current
    if (!curEl) return

    const maskEl = document.createElement('canvas')
    const mctx   = maskEl.getContext('2d')!

    const setup = () => {
      maskEl.width  = Math.floor(window.innerWidth  * MASK_SCALE)
      maskEl.height = Math.floor(window.innerHeight * MASK_SCALE)
      mctx.fillStyle = 'white'
      mctx.fillRect(0, 0, maskEl.width, maskEl.height)
      applyMask()
    }

    const applyMask = () => {
      const url = maskEl.toDataURL()
      curEl.style.maskImage       = `url(${url})`
      curEl.style.webkitMaskImage = `url(${url})`
    }

    setup()
    window.addEventListener('resize', setup)

    curEl.style.maskSize         = '100% 100%'
    curEl.style.webkitMaskSize   = '100% 100%'
    curEl.style.maskRepeat       = 'no-repeat'
    curEl.style.webkitMaskRepeat = 'no-repeat'

    const st = {
      mouse:  { x: -9999, y: -9999 },
      paint:  { x: -9999, y: -9999 },
      prev:   { x: -9999, y: -9999 },
      fading: false,
      idx:    0,
      ticker: 0,
      frame:  0,
      vel:    0,
    }

    const paintAt = (x: number, y: number, speed: number) => {
      const cx = x * MASK_SCALE
      const cy = y * MASK_SCALE
      const r  = (BASE_R + Math.min(speed * 0.15, 30)) * MASK_SCALE

      const g = mctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      g.addColorStop(0,    'rgba(0,0,0,1)')
      g.addColorStop(0.60, 'rgba(0,0,0,0.97)')
      g.addColorStop(0.80, 'rgba(0,0,0,0.40)')
      g.addColorStop(0.92, 'rgba(0,0,0,0.06)')
      g.addColorStop(1,    'rgba(0,0,0,0)')

      mctx.globalCompositeOperation = 'destination-out'
      mctx.fillStyle = g
      mctx.beginPath()
      mctx.arc(cx, cy, r, 0, Math.PI * 2)
      mctx.fill()
      mctx.globalCompositeOperation = 'source-over'
    }

    const getCoverage = (): number => {
      const d = mctx.getImageData(0, 0, maskEl.width, maskEl.height).data
      let lit = 0, tot = 0
      for (let i = 3; i < d.length; i += 4 * SAMPLE_GAP) {
        if (d[i] > 30) lit++
        tot++
      }
      return lit / tot
    }

    const transition = () => {
      if (st.fading) return
      st.fading = true
      st.idx = (st.idx + 1) % IMAGES.length
      setCurrent(st.idx)
      setNext((st.idx + 1) % IMAGES.length)
      setTimeout(() => {
        mctx.globalCompositeOperation = 'source-over'
        mctx.fillStyle = 'white'
        mctx.fillRect(0, 0, maskEl.width, maskEl.height)
        applyMask()
        st.fading = false
      }, 50)
    }

    let raf: number

    const tick = () => {
      st.frame++

      if (st.mouse.x > -1000) {
        if (st.paint.x < -1000) st.paint = { ...st.mouse }
        st.paint.x += (st.mouse.x - st.paint.x) * LERP
        st.paint.y += (st.mouse.y - st.paint.y) * LERP
      }

      if (!st.fading && st.paint.x > -1000) {
        const dx   = st.paint.x - st.prev.x
        const dy   = st.paint.y - st.prev.y
        const dist = Math.hypot(dx, dy)
        if (dist > 0.5) {
          const steps = Math.max(1, Math.floor(dist / STROKE_STEP))
          for (let i = 1; i <= steps; i++) {
            const t = i / steps
            paintAt(st.prev.x + dx * t, st.prev.y + dy * t, dist)
          }
          st.vel = Math.min(st.vel + dist * 0.25, 22)
          st.prev = { ...st.paint }
        }
      }

      st.vel *= 0.90

      if (!st.fading && ++st.ticker % COVERAGE_TICK === 0 && getCoverage() <= (1 - COVERAGE_GOAL)) {
        transition()
      }

      if (st.frame % MASK_EVERY === 0) applyMask()

      raf = requestAnimationFrame(tick)
    }

    const onMove = (e: MouseEvent) => {
      if (st.mouse.x < -1000) st.prev = { x: e.clientX, y: e.clientY }
      st.mouse = { x: e.clientX, y: e.clientY }
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', setup)
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  const curImg  = IMAGES[current]
  const nextImg = IMAGES[next]

  const imgBase: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '88vh',
    backgroundSize: 'cover',
    filter: 'brightness(0.82) saturate(0.65) hue-rotate(12deg)',
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden>
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="sisgo-liquid" x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence type="fractalNoise" baseFrequency="0.006 0.005" numOctaves="2" seed="5" result="noise" />
            <feDisplacementMap id="sisgo-dm" in="SourceGraphic" in2="noise"
              scale="10" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 110% 70% at 50% 15%, rgba(10,28,26,0.99) 0%, #030d0b 60%, #020b09 100%)',
      }} />

      {/* Próxima imagem — estática embaixo */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '88vh' }}>
        <div style={{ ...imgBase, backgroundPosition: nextImg.pos, backgroundImage: `url(${nextImg.src})` }} />
      </div>

      {/* Imagem atual — filtro SVG + máscara de erosão numa camada só */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '88vh',
        filter: 'url(#sisgo-liquid)', willChange: 'filter',
      }}>
        <div
          ref={curRef}
          style={{ ...imgBase, backgroundPosition: curImg.pos, backgroundImage: `url(${curImg.src})` }}
        />
      </div>

      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, transparent 55vh, #030d0b 88vh)',
      }} />
    </div>
  )
}
