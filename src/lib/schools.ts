export const SCHOOL_TYPES = [
  { value: 'eted', label: 'ETED - Escola de Treinamento e Discipulado', group: 'eted' },
  { value: 'segundo_nivel', label: 'Escola de 2º Nível', group: 'second_level' },
  { value: 'udn', label: 'UDN - Universidade das Nações', group: 'second_level' },
  { value: 'seminario', label: 'Seminário', group: 'second_level' },
  { value: 'curso_online', label: 'Curso Online', group: 'second_level' },
  { value: 'voluntariado', label: 'Voluntariado', group: 'other' },
  { value: 'outro', label: 'Outra escola', group: 'other' },
] as const

export const SCHOOL_APPLICATION_TYPES = ['eted', 'segundo_nivel', 'udn', 'seminario', 'curso_online'] as const

const SECOND_LEVEL_TYPES = new Set(['segundo_nivel', 'udn', 'seminario', 'curso_online'])

export function schoolTypeLabel(type?: string | null): string {
  return SCHOOL_TYPES.find(item => item.value === type)?.label ?? 'Escola'
}

export function schoolTypeShortLabel(type?: string | null): string {
  if (type === 'eted') return 'ETED'
  if (SECOND_LEVEL_TYPES.has(type ?? '')) return 'Escola de 2º Nível'
  if (type === 'voluntariado') return 'Voluntariado'
  return 'Escola'
}

export function schoolTypeGroup(type?: string | null): 'eted' | 'second_level' | 'other' {
  if (type === 'eted') return 'eted'
  if (SECOND_LEVEL_TYPES.has(type ?? '')) return 'second_level'
  return 'other'
}
