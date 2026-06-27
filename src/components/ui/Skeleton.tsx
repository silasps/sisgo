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
    <div className="h-16 shrink-0 border-b border-gray-200 bg-white flex items-center justify-between px-4 md:px-6">
      <Sk className="h-5 w-36" />
      <Sk className="h-8 w-24 rounded-lg" />
    </div>
  )
}

/* Tabela */
export function SkTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  const mobileCols = Math.min(cols, 2)
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* thead */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex gap-4 md:gap-6">
        {Array.from({ length: cols }).map((_, i) => (
          <Sk key={i} className={`h-4 flex-1 ${i >= mobileCols ? 'hidden md:block' : ''}`} />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3 flex gap-4 md:gap-6 border-b border-gray-100 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Sk
              key={c}
              className={`h-4 flex-1 ${c === 0 ? 'max-w-[180px]' : ''} ${c >= mobileCols ? 'hidden md:block' : ''}`}
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
    <div className={`grid grid-cols-2 gap-3 md:gap-4 ${n >= 4 ? 'md:grid-cols-4' : n >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 md:p-5 flex items-start gap-3 md:gap-4">
          <Sk className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5 md:space-y-2 pt-0.5 md:pt-1">
            <Sk className="h-5 md:h-6 w-10 md:w-12" />
            <Sk className="h-3 w-16 md:w-24" />
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
