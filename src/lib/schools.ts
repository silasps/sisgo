// `school_type` é a CATEGORIA de comportamento (formulário curto/longo,
// matrícula automática) — os valores nunca mudam porque a API pública
// (api/public/[slug]/schools, .../events) expõe esse campo pra sites
// institucionais externos que já comparam com esses literais (ex.:
// `school_type === 'eted'` no site institucional). O que a instituição
// digita e vê nos cards é `schools.type_name` (texto livre, ver
// `schoolDisplayType`) — os rótulos abaixo descrevem só a categoria de
// comportamento, por isso ficam genéricos (não amarrados a nomenclatura
// específica de uma instituição).
export const SCHOOL_TYPES = [
  { value: 'eted', label: 'Programa de formação (formulário completo)', group: 'eted' },
  { value: 'seminario', label: 'Curso curto (formulário simplificado, matrícula automática)', group: 'seminario' },
  { value: 'segundo_nivel', label: 'Curso de nível avançado', group: 'second_level' },
  { value: 'outro', label: 'Outro', group: 'other' },
] as const

export const SCHOOL_APPLICATION_TYPES = ['eted', 'segundo_nivel', 'udn', 'seminario', 'curso_online'] as const

const SECOND_LEVEL_TYPES = new Set(['segundo_nivel', 'udn', 'curso_online'])

export function schoolTypeLabel(type?: string | null): string {
  return SCHOOL_TYPES.find(item => item.value === type)?.label ?? 'Escola'
}

// Rótulo genérico de fallback, só usado quando a escola não tem type_name
// preenchido (dado legado). Prefira schoolDisplayType.
export function schoolTypeShortLabel(type?: string | null): string {
  if (type === 'eted') return 'Programa de Formação'
  if (type === 'seminario') return 'Curso Curto'
  if (SECOND_LEVEL_TYPES.has(type ?? '')) return 'Nível Avançado'
  return 'Escola'
}

// Nome exibido nos cards/páginas públicas: o texto livre que a instituição
// digitou (`type_name`) — cada instituição nomeia seus programas do jeito
// que faz sentido pra ela (ETED, Curso Técnico, Pós-graduação...), em vez
// de um rótulo fixo de categoria. Cai pro rótulo genérico da categoria só
// pra escolas antigas sem type_name preenchido.
export function schoolDisplayType(school: { school_type?: string | null; type_name?: string | null }): string {
  return school.type_name?.trim() || schoolTypeShortLabel(school.school_type)
}

export function schoolTypeGroup(type?: string | null): 'eted' | 'seminario' | 'second_level' | 'other' {
  if (type === 'eted') return 'eted'
  if (type === 'seminario') return 'seminario'
  if (SECOND_LEVEL_TYPES.has(type ?? '')) return 'second_level'
  return 'other'
}
