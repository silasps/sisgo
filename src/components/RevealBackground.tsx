'use client'
import { useEffect, useRef, useState } from 'react'

const IMAGES = [
  { src: '/images/people-india.jpg',  pos: '48% 42%' },
  { src: '/images/people-africa.jpg', pos: '52% 38%' },
  { src: '/images/people-arab.jpg',   pos: '48% 40%' },
  { src: '/images/people-sea.jpg',    pos: '50% 43%' },
  { src: '/images/people-asia.jpg',   pos: '50% 40%' },
]

// Máscara em resolução reduzida para performance no toDataURL
const MASK_SCALE    = 0.25
const BASE_R        = 160
const STROKE_STEP   = 10
const COVERAGE_GOAL = 0.85
const SAMPLE_GAP    = 4
const LERP          = 0.12 // 0–1: menor = mais atraso no cursor
const FADE_MS       = 1000

export function RevealBackground() {
  const nextRef  = useRef<HTMLDivElement>(null)   // imagem revelada pelo mouse
  const [current, setCurrent] = useState(0)
  const [next,    setNext]    = useState(1)

  useEffect(() => {
    const nextImg = nextRef.current
    if (!nextImg) return

    // Canvas só para acumular a máscara (não desenha imagens)
    const maskEl = document.createElement('canvas')
    const mctx   = maskEl.getContext('2d')!

    // Configuração inicial e no resize
    const setup = () => {
      maskEl.width  = Math.floor(window.innerWidth  * MASK_SCALE)
      maskEl.height = Math.floor(window.innerHeight * MASK_SCALE)
      // Reseta máscara ao redimensionar
      mctx.clearRect(0, 0, maskEl.width, maskEl.height)
      applyMask()
    }

    // Aplica o canvas como CSS mask-image na div da próxima imagem
    const applyMask = () => {
      const url = maskEl.toDataURL()
      nextImg.style.maskImage          = `url(${url})`
      nextImg.style.webkitMaskImage    = `url(${url})`
    }

    setup()
    window.addEventListener('resize', setup)

    // Configurações fixas de máscara (aplicadas uma vez)
    nextImg.style.maskSize         = '100% 100%'
    nextImg.style.webkitMaskSize   = '100% 100%'
    nextImg.style.maskRepeat       = 'no-repeat'
    nextImg.style.webkitMaskRepeat = 'no-repeat'

    const dm = document.getElementById('sisgo-dm') as SVGFEDisplacementMapElement | null

    const st = {
      mouse:  { x: -9999, y: -9999 },
      paint:  { x: -9999, y: -9999 },
      prev:   { x: -9999, y: -9999 },
      fading: false,
      idx:    0,
      ticker: 0,
      frame:  0,
      vel:    0,   // velocidade do mouse — controla intensidade do líquido
    }

    // Pintura fluida: circular, gradiente suave
    const paintAt = (x: number, y: number, speed: number) => {
      const cx = x * MASK_SCALE
      const cy = y * MASK_SCALE
      const r  = (BASE_R + Math.min(speed * 0.15, 30)) * MASK_SCALE

      const g = mctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      g.addColorStop(0,    'rgba(255,255,255,1)')
      g.addColorStop(0.50, 'rgba(255,255,255,0.98)')
      g.addColorStop(0.75, 'rgba(255,255,255,0.55)')
      g.addColorStop(0.90, 'rgba(255,255,255,0.12)')
      g.addColorStop(1,    'rgba(255,255,255,0)')

      mctx.fillStyle = g
      mctx.beginPath()
      mctx.arc(cx, cy, r, 0, Math.PI * 2)
      mctx.fill()
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

      // next vira current; avança next para o seguinte
      st.idx = (st.idx + 1) % IMAGES.length
      const newNext = (st.idx + 1) % IMAGES.length
      setCurrent(st.idx)
      setNext(newNext)

      // Limpa canvas para começar a revelar a nova próxima imagem
      setTimeout(() => {
        mctx.clearRect(0, 0, maskEl.width, maskEl.height)
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

      // Decai velocidade e atualiza intensidade do displacement
      st.vel *= 0.88
      if (dm) dm.setAttribute('scale', (14 + st.vel).toFixed(1))

      // Verifica cobertura a cada 45 frames
      if (!st.fading && ++st.ticker % 45 === 0 && getCoverage() >= COVERAGE_GOAL) {
        transition()
      }

      // Aplica máscara a cada 2 frames (~30fps)
      if (st.frame % 2 === 0) applyMask()

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
      {/* SVG filter: líquido */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="sisgo-liquid" x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.009" numOctaves="4" seed="5" result="warp">
              <animate attributeName="baseFrequency"
                values="0.012 0.009; 0.016 0.012; 0.013 0.007; 0.015 0.010; 0.012 0.009"
                dur="14s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap id="sisgo-dm" in="SourceGraphic" in2="warp"
              scale="14" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* Fundo escuro base */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 110% 70% at 50% 15%, rgba(10,28,26,0.99) 0%, #030d0b 60%, #020b09 100%)',
      }} />

      {/* Imagem ATUAL — sempre visível por baixo, também com efeito líquido */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '88vh', filter: 'url(#sisgo-liquid)' }}>
        <div style={{ ...imgBase, backgroundPosition: curImg.pos, backgroundImage: `url(${curImg.src})` }} />
      </div>

      {/*
        Imagem PRÓXIMA:
        - nextRef (inner): recebe a máscara circular do canvas
        - wrapper (outer): aplica o filtro líquido DEPOIS da máscara
        → as bordas da revelação ficam com forma orgânica/líquida, não circular
      */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '88vh',
        filter: 'url(#sisgo-liquid)',
      }}>
        <div
          ref={nextRef}
          style={{ ...imgBase, backgroundPosition: nextImg.pos, backgroundImage: `url(${nextImg.src})` }}
        />
      </div>

      {/* Fade para escuro abaixo do hero */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, transparent 55vh, #030d0b 88vh)',
      }} />
    </div>
  )
}
