/** Categorias de anúncio de base — vira badge colorido no card/modal. */
export const ANNOUNCEMENT_CATEGORIES: Array<{ value: string; label: string; className: string }> = [
  { value: 'aviso', label: 'Aviso', className: 'bg-gray-100 text-gray-600' },
  { value: 'evento', label: 'Evento', className: 'bg-blue-50 text-blue-600' },
  { value: 'oportunidade', label: 'Oportunidade', className: 'bg-purple-50 text-purple-600' },
  { value: 'urgente', label: 'Urgente', className: 'bg-red-50 text-red-600' },
]

export const CATEGORY_STYLES: Record<string, { label: string; className: string }> =
  Object.fromEntries(ANNOUNCEMENT_CATEGORIES.map(c => [c.value, c]))
