'use client'

import { useEffect, useRef, useState } from 'react'

type Segment = { label: string; value: number; color: string; key?: string }

function useCountUp(target: number, active: boolean, duration = 700): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) { setVal(0); return }
    if (target === 0) { setVal(0); return }
    let raf: number
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - t0) / duration, 1)
      setVal(Math.round(target * (1 - (1 - t) ** 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active, duration])
  return val
}

export function AnimatedDonutChart({ segments, title, activeValue, onSelect }: {
  segments: Segment[]
  title?: string
  /** Valor atualmente ativo (pra destacar a fatia/legenda selecionada). */
  activeValue?: string
  /** Chamado com a key/label da fatia clicada. Presença desse prop torna
   * o gráfico clicável — cabe ao chamador decidir o que fazer com a
   * seleção (ex.: alternar um filtro local). */
  onSelect?: (key: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  function handleSegmentClick(seg: Segment) {
    if (!onSelect || seg.value === 0) return
    onSelect(seg.key ?? seg.label)
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const displayTotal = useCountUp(total, visible)

  // Legenda cabe pouco ao lado da rosquinha — acima de 4 itens, esconde o
  // resto atrás de um "···" que a pessoa expande, em vez de empurrar a
  // lista de baixo (o motivo de ela estar filtrando) pra fora da tela.
  const LEGEND_LIMIT = 4
  const [showAllLegend, setShowAllLegend] = useState(false)
  const visibleSegments = showAllLegend ? segments : segments.slice(0, LEGEND_LIMIT)
  const hiddenCount = segments.length - LEGEND_LIMIT

  const r = 52, cx = 68, cy = 68, sw = 22, gap = 3
  const C = 2 * Math.PI * r
  const active = segments.filter(s => s.value > 0)

  let acc = 0
  const arcs = active.map((seg, i) => {
    const len = (seg.value / total) * C
    const dl = Math.max(0, len - gap)
    const off = -acc
    acc += len
    return { ...seg, dl, off, i }
  })

  return (
    <div ref={ref} className="flex flex-row items-center gap-4 sm:gap-6 w-full">
      <div className="shrink-0">
        <svg viewBox="0 0 136 136" className="w-24 h-24 sm:w-36 sm:h-36">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={sw} />
          {total > 0 && arcs.map(a => {
            const key = a.key ?? a.label
            const dimmed = onSelect && activeValue && activeValue !== key
            return (
              <circle
                key={a.label}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={sw}
                strokeDasharray={visible ? `${a.dl} ${C}` : `0 ${C}`}
                strokeDashoffset={a.off}
                strokeLinecap="butt"
                transform={`rotate(-90 ${cx} ${cy})`}
                opacity={dimmed ? 0.3 : 1}
                onClick={() => handleSegmentClick(a)}
                style={{
                  cursor: onSelect ? 'pointer' : undefined,
                  transition: `stroke-dasharray 0.9s cubic-bezier(0.34,1.56,0.64,1) ${a.i * 0.1}s, opacity 0.2s ease`,
                }}
              />
            )
          })}
          <circle cx={cx} cy={cy} r={r - sw / 2 - 1} fill="white" />
          <text
            x={cx} y={cy - 5} textAnchor="middle"
            fill="#111827" fontSize="20" fontWeight="700"
            fontFamily="ui-sans-serif,system-ui,sans-serif"
            style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease 0.2s' }}
          >
            {displayTotal}
          </text>
          <text
            x={cx} y={cy + 12} textAnchor="middle"
            fill="#9CA3AF" fontSize="9"
            fontFamily="ui-sans-serif,system-ui,sans-serif"
            style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease 0.4s' }}
          >
            {title ?? 'total'}
          </text>
        </svg>
      </div>

      <div className="flex flex-col gap-y-2 sm:gap-y-2.5 flex-1 min-w-0 w-full sm:grid sm:grid-cols-2 sm:gap-x-6">
        {visibleSegments.map((seg, i) => {
          const key = seg.key ?? seg.label
          const clickable = Boolean(onSelect) && seg.value > 0
          const dimmed = onSelect && activeValue && activeValue !== key
          const Tag = clickable ? 'button' : 'div'
          return (
            <Tag
              key={seg.label}
              type={clickable ? 'button' : undefined}
              onClick={clickable ? () => handleSegmentClick(seg) : undefined}
              className={`flex items-center gap-2 min-w-0 text-left ${clickable ? 'cursor-pointer hover:opacity-80' : ''}`}
              style={{
                opacity: visible ? (dimmed ? 0.4 : 1) : 0,
                transform: visible ? 'translateY(0)' : 'translateY(8px)',
                transition: `opacity 0.2s ease, transform 0.4s ease ${i * 0.04 + 0.4}s`,
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              <div className="min-w-0">
                <p className={`text-xs truncate leading-tight ${activeValue === key ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>{seg.label}</p>
                <p className="text-sm font-bold text-gray-900 leading-tight">{seg.value}</p>
              </div>
            </Tag>
          )
        })}
        {!showAllLegend && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAllLegend(true)}
            className="flex items-center gap-2 min-w-0 text-left text-gray-400 hover:text-gray-600 transition-colors"
          >
            <div className="w-2.5 h-2.5 shrink-0 flex items-center justify-center text-sm leading-none">···</div>
            <span className="text-xs font-medium">mais {hiddenCount}</span>
          </button>
        )}
      </div>
    </div>
  )
}
