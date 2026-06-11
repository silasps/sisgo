type Segment = { label: string; value: number; color: string }

export function DonutChart({ segments, title }: { segments: Segment[]; title?: string }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  const r = 52
  const cx = 68
  const cy = 68
  const strokeWidth = 22
  const gap = 3
  const circumference = 2 * Math.PI * r
  const active = segments.filter(s => s.value > 0)

  // Build arcs: each segment positioned after the previous one
  let accumulated = 0
  const arcs = active.map(seg => {
    const len = (seg.value / total) * circumference
    const dashLen = Math.max(0, len - gap)
    const offset = -accumulated
    accumulated += len
    return { ...seg, dashLen, offset }
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full">
      {/* SVG donut */}
      <div className="shrink-0">
        <svg viewBox="0 0 136 136" className="w-28 h-28 sm:w-36 sm:h-36">
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} />
          ) : (
            arcs.map(arc => (
              <circle
                key={arc.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${arc.dashLen} ${circumference}`}
                strokeDashoffset={arc.offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            ))
          )}
          {/* Hole */}
          <circle cx={cx} cy={cy} r={r - strokeWidth / 2 - 1} fill="white" />
          {/* Center label */}
          <text
            x={cx}
            y={cy - 5}
            textAnchor="middle"
            fill="#111827"
            fontSize="20"
            fontWeight="700"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {total}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            fill="#9CA3AF"
            fontSize="9"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {title ?? 'total'}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2 sm:gap-y-2.5 flex-1 w-full">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-2 min-w-0">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
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
