import type { Lang } from '@/lib/i18n/forms'

/** Escolhe a versão certa de um texto livre cadastrado pela organização
 * (descrição de escola/turma/ministério) para o idioma do visitante.
 * O idioma "original" (em que o texto foi escrito) é sempre `pt` — não há
 * tradução automática: sem uma versão salva pra `lang`, cai no original. */
export function resolveLocalizedText(
  original: string | null | undefined,
  translations: Partial<Record<'en' | 'es', string>> | null | undefined,
  lang: Lang
): string | null {
  if (lang === 'pt') return original ?? null
  const translated = translations?.[lang]?.trim()
  return translated || (original ?? null)
}
