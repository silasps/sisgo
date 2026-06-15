// Paleta curada de cores de destaque para personalização das bases.
// Os valores 'rgb' são canais R G B separados por espaço para suportar
// modificadores de opacidade do Tailwind (ex: bg-brand-500/30).
export const ACCENT_COLORS = {
  laranja: {
    label: 'Laranja',
    hex:   { 400: '#f89547', 500: '#f47920', 600: '#e05e0a' },
    rgb:   { 400: '248 149 71', 500: '244 121 32', 600: '224 94 10' },
  },
  azul: {
    label: 'Azul',
    hex:   { 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb' },
    rgb:   { 400: '96 165 250', 500: '59 130 246', 600: '37 99 235' },
  },
  verde: {
    label: 'Verde',
    hex:   { 400: '#4ade80', 500: '#22c55e', 600: '#16a34a' },
    rgb:   { 400: '74 222 128', 500: '34 197 94', 600: '22 163 74' },
  },
  roxo: {
    label: 'Roxo',
    hex:   { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' },
    rgb:   { 400: '167 139 250', 500: '139 92 246', 600: '124 58 237' },
  },
  rosa: {
    label: 'Rosa',
    hex:   { 400: '#f472b6', 500: '#ec4899', 600: '#db2777' },
    rgb:   { 400: '244 114 182', 500: '236 72 153', 600: '219 39 119' },
  },
  vermelho: {
    label: 'Vermelho',
    hex:   { 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
    rgb:   { 400: '248 113 113', 500: '239 68 68', 600: '220 38 38' },
  },
  ciano: {
    label: 'Ciano',
    hex:   { 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2' },
    rgb:   { 400: '34 211 238', 500: '6 182 212', 600: '8 145 178' },
  },
  amarelo: {
    label: 'Amarelo',
    hex:   { 400: '#facc15', 500: '#eab308', 600: '#ca8a04' },
    rgb:   { 400: '250 204 21', 500: '234 179 8', 600: '202 138 4' },
  },
  petroleo: {
    label: 'Petróleo',
    hex:   { 400: '#408e8a', 500: '#1d6b67', 600: '#16504d' },
    rgb:   { 400: '64 142 138', 500: '29 107 103', 600: '22 80 77' },
  },
} as const

export type AccentColorKey = keyof typeof ACCENT_COLORS

export function getAccentColor(key: string) {
  return ACCENT_COLORS[key as AccentColorKey] ?? ACCENT_COLORS.laranja
}

export function accentCssVars(key: string): string {
  const c = getAccentColor(key)
  return [
    `--brand-400:${c.rgb[400]}`,
    `--brand-500:${c.rgb[500]}`,
    `--brand-600:${c.rgb[600]}`,
  ].join(';')
}
