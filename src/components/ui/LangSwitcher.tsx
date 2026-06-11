'use client'

import type { Lang } from '@/lib/i18n/forms'

const OPTIONS: { lang: Lang; label: string }[] = [
  { lang: 'pt', label: 'PT' },
  { lang: 'en', label: 'EN' },
  { lang: 'es', label: 'ES' },
]

export function LangSwitcher({
  lang,
  onChange,
  uiLabel,
}: {
  lang: Lang
  onChange: (l: Lang) => void
  uiLabel?: string
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {uiLabel && (
        <span className="text-xs text-gray-400">{uiLabel}</span>
      )}
      <div className="flex gap-1">
        {OPTIONS.map(o => (
          <button
            key={o.lang}
            type="button"
            onClick={() => onChange(o.lang)}
            className={[
              'px-3 py-1 text-xs font-bold rounded-lg border transition-colors',
              lang === o.lang
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600',
            ].join(' ')}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
