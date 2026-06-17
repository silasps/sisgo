'use client'

import { useEffect, useRef, useState } from 'react'

type Segment = { label: string; value: number; color: string }

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

export function AnimatedDonutChart({ segments, title }: { segments: Segment[]; title?: string }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
    <div ref={ref} className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full">
      <div className="shrink-0">
        <svg viewBox="0 0 136 136" className="w-28 h-28 sm:w-36 sm:h-36">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={sw} />
          {total > 0 && arcs.map(a => (
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
              style={{
                transition: `stroke-dasharray 0.9s cubic-bezier(0.34,1.56,0.64,1) ${a.i * 0.1}s`,
              }}
            />
          ))}
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

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2 sm:gap-y-2.5 flex-1 w-full">
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className="flex items-center gap-2 min-w-0"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(8px)',
              transition: `opacity 0.4s ease ${i * 0.04 + 0.4}s, transform 0.4s ease ${i * 0.04 + 0.4}s`,
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate leading-tight">{seg.label}</p>
              <p className="text-sm font-bold text-gray-900 leading-tight">{seg.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
