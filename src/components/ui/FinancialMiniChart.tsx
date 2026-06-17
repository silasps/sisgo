'use client'

import { useEffect, useRef, useState } from 'react'

type MonthData = { month: string; income: number; expense: number }

export function FinancialMiniChart({ data }: { data: MonthData[] }) {
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

  const max = Math.max(...data.flatMap(d => [d.income, d.expense]), 1)
  const barH = 100

  const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  return (
    <div ref={ref}>
      <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: barH + 28 }}>
        {data.map((d, i) => {
          const ih = (d.income / max) * barH
          const eh = (d.expense / max) * barH
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-end gap-px w-full justify-center" style={{ height: barH }}>
                <div
                  className="flex-1 max-w-[10px] rounded-t-sm bg-emerald-400/80 hover:bg-emerald-500 transition-colors relative group cursor-default"
                  style={{
                    height: visible ? Math.max(ih, 2) : 0,
                    transition: `height 0.7s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.08}s`,
                  }}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {fmtBRL(d.income)}
                  </div>
                </div>
                <div
                  className="flex-1 max-w-[10px] rounded-t-sm bg-red-400/80 hover:bg-red-500 transition-colors relative group cursor-default"
                  style={{
                    height: visible ? Math.max(eh, 2) : 0,
                    transition: `height 0.7s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.08 + 0.05}s`,
                  }}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {fmtBRL(d.expense)}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-gray-400 font-medium leading-none">{d.month}</span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-gray-500">Receitas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-[11px] text-gray-500">Despesas</span>
        </div>
      </div>
    </div>
  )
}
