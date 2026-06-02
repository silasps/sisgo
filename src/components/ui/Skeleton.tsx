type Props = { className?: string }

export function Sk({ className = '' }: Props) {
  return <div className={`shimmer ${className}`} />
}

/* Linha de texto genérica */
export function SkText({ w = 'w-32', h = 'h-4' }: { w?: string; h?: string }) {
  return <Sk className={`${w} ${h}`} />
}

/* Cabeçalho de página (Header) */
export function SkHeader() {
  return (
    <div className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6">
      <Sk className="h-5 w-36" />
      <Sk className="h-8 w-24 rounded-lg" />
    </div>
  )
}

/* Tabela */
export function SkTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* thead */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex gap-6">
        {Array.from({ length: cols }).map((_, i) => (
          <Sk key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3 flex gap-6 border-b border-gray-100 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Sk
              key={c}
              className={`h-4 flex-1 ${c === 0 ? 'max-w-[180px]' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/* Cards de stats */
export function SkStatCards({ n = 3 }: { n?: number }) {
  return (
    <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
          <Sk className="w-10 h-10 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <Sk className="h-6 w-12" />
            <Sk className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* Grid de cards (escolas, ministérios) */
export function SkCardGrid({ n = 6 }: { n?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex justify-between items-start">
            <Sk className="h-5 w-36" />
            <Sk className="h-5 w-14 rounded-full" />
          </div>
          <Sk className="h-3 w-full" />
          <Sk className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  )
}
