'use client'

import { useState } from 'react'

type Locale = 'en' | 'es'

const TABS: { key: 'pt' | Locale; flag: string; label: string }[] = [
  { key: 'pt', flag: '🇧🇷', label: 'PT' },
  { key: 'en', flag: '🇺🇸', label: 'EN' },
  { key: 'es', flag: '🇪🇸', label: 'ES' },
]

const MISSING_LABEL: Record<Locale, string> = { en: 'inglês', es: 'espanhol' }

/**
 * Campo de texto com abas por idioma (PT original + EN/ES manuais), pra usar
 * dentro de um <form action={serverAction}> nativo. O textarea PT sempre
 * carrega `name={name}` (posta normalmente, esteja a aba ativa ou não); as
 * traduções EN/ES vão como JSON num único input hidden `name={translationsName}`
 * — a server action precisa fazer `JSON.parse(formData.get(translationsName))`.
 */
export function LocaleContentTabs({
  label, name, defaultValue, translationsName, defaultTranslations,
  rows = 4, placeholder,
}: {
  label: string
  name: string
  defaultValue: string
  translationsName: string
  defaultTranslations: Partial<Record<Locale, string>>
  rows?: number
  placeholder?: string
}) {
  const [active, setActive] = useState<'pt' | Locale>('pt')
  const [original, setOriginal] = useState(defaultValue)
  const [translations, setTranslations] = useState<Partial<Record<Locale, string>>>(defaultTranslations)

  const hasContent = (key: 'pt' | Locale) => key === 'pt' ? !!original.trim() : !!translations[key]?.trim()
  const missing = original.trim() ? (['en', 'es'] as Locale[]).filter(l => !translations[l]?.trim()) : []

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>

      <div className="flex items-center gap-1 mb-1.5">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              active === t.key ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span>{t.flag}</span>
            {t.label}
            <span className={`size-1.5 rounded-full ${hasContent(t.key) ? 'bg-green-500' : 'bg-gray-300'}`} />
          </button>
        ))}
      </div>

      <textarea
        name={name}
        value={original}
        onChange={e => setOriginal(e.target.value)}
        hidden={active !== 'pt'}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
      />
      <textarea
        value={translations.en ?? ''}
        onChange={e => setTranslations(prev => ({ ...prev, en: e.target.value }))}
        hidden={active !== 'en'}
        rows={rows}
        placeholder="Translate to English…"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
      />
      <textarea
        value={translations.es ?? ''}
        onChange={e => setTranslations(prev => ({ ...prev, es: e.target.value }))}
        hidden={active !== 'es'}
        rows={rows}
        placeholder="Traducir al español…"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
      />
      <input type="hidden" name={translationsName} value={JSON.stringify(translations)} />

      {missing.length > 0 && (
        <p className="text-xs text-amber-600 mt-1.5 flex items-start gap-1">
          <span>⚠️</span>
          Sem tradução em {missing.map(l => MISSING_LABEL[l]).join(' e ')} — visitantes que só leem
          {missing.length > 1 ? ' esses idiomas' : ` ${MISSING_LABEL[missing[0]]}`} vão ver o texto em português.
        </p>
      )}
    </div>
  )
}
