export type { StaffFormDict } from './types'
export type { StaffLang } from './types'
export { ptDict } from './pt'
export { enDict } from './en'
export { esDict } from './es'

import type { StaffLang, StaffFormDict } from './types'
import { ptDict } from './pt'
import { enDict } from './en'
import { esDict } from './es'

const LANG_MAP: Record<string, StaffLang> = {
  pt: 'pt', 'pt-BR': 'pt', 'pt-PT': 'pt', 'pt-br': 'pt',
  en: 'en', 'en-US': 'en', 'en-GB': 'en', 'en-us': 'en',
  es: 'es', 'es-MX': 'es', 'es-AR': 'es', 'es-CL': 'es', 'es-CO': 'es', 'es-mx': 'es',
}

export function normalizeStaffLang(raw?: string | null): StaffLang {
  if (!raw) return 'pt'
  return LANG_MAP[raw] ?? LANG_MAP[raw.slice(0, 2)] ?? 'pt'
}

const DICTS: Record<StaffLang, StaffFormDict> = { pt: ptDict, en: enDict, es: esDict }

export function getStaffFormDict(lang: StaffLang): StaffFormDict {
  return DICTS[lang]
}

/** Replace {key} placeholders in a staff dict string */
export function tStaff(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}
