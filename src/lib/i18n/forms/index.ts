export type { FormDict, Lang } from './types'
export { ptDict } from './pt'
export { enDict } from './en'
export { esDict } from './es'

import type { Lang, FormDict } from './types'
import { ptDict } from './pt'
import { enDict } from './en'
import { esDict } from './es'

const LANG_MAP: Record<string, Lang> = {
  pt: 'pt', 'pt-BR': 'pt', 'pt-PT': 'pt', 'pt-br': 'pt',
  en: 'en', 'en-US': 'en', 'en-GB': 'en', 'en-us': 'en',
  es: 'es', 'es-MX': 'es', 'es-AR': 'es', 'es-CL': 'es', 'es-CO': 'es', 'es-mx': 'es',
}

export function normalizeLang(raw?: string | null): Lang {
  if (!raw) return 'pt'
  return LANG_MAP[raw] ?? LANG_MAP[raw.slice(0, 2)] ?? 'pt'
}

const DICTS: Record<Lang, FormDict> = { pt: ptDict, en: enDict, es: esDict }

export function getFormDict(lang: Lang): FormDict {
  return DICTS[lang]
}

/** Replace {key} placeholders in a dict string */
export function t(str: string, vars: Record<string, string>): string {
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}
