// Guia visual de enquadramento pra foto 3x4 — um desenho genérico (cabeça e
// ombros centralizados, sem rosto real), não uma foto de verdade. Mostrado
// como modelo ANTES da pessoa anexar, pra ela saber como enquadrar a
// própria foto sem precisar reproduzir/mostrar um documento ou retrato real.
export function PhotoFramingGuide({ caption, tone = 'amber' }: { caption: string; tone?: 'amber' | 'indigo' }) {
  const ring = tone === 'amber' ? 'stroke-amber-300' : 'stroke-indigo-300'
  const fill = tone === 'amber' ? 'fill-amber-200' : 'fill-indigo-200'
  return (
    <div className="flex items-center gap-3 mb-3 px-1">
      <svg width="52" height="68" viewBox="0 0 52 68" className="shrink-0">
        <rect x="1" y="1" width="50" height="66" rx="6" className="fill-gray-50 stroke-gray-200" strokeWidth="1.5" />
        <rect x="6" y="6" width="40" height="56" rx="3" fill="none" className={ring} strokeWidth="1" strokeDasharray="2 2" />
        <circle cx="26" cy="27" r="11" className={fill} />
        <path d="M10 60c2-11 8.5-17 16-17s14 6 16 17" className={fill} />
      </svg>
      <p className="text-[11px] text-gray-400 leading-snug">{caption}</p>
    </div>
  )
}
