export type BoardColumn = {
  id: string
  name: string
  position: number
  is_done: boolean
}

export type BoardCard = {
  id: string
  column_id: string
  title: string
  description: string | null
  position: number
  priority: 'baixa' | 'media' | 'alta'
  assignee_person_id: string | null
  due_date: string | null
  labels: string[] | null
  announcement_id: string | null
  completed_at: string | null
  created_by: string
}

// Não dá pra colorir coluna pelo nome (líder pode renomear/criar à vontade),
// só existe o sinal estrutural `is_done` + a ordem. Então a categoria vem
// de onde a coluna está no fluxo: a primeira não-concluída é "a fazer", as
// do meio são "fazendo", e `is_done` é "concluído" — mesma leitura que
// Jira/ClickUp fazem com "status categories" (to do/in progress/done), só
// que aqui é inferida em vez de configurada.
export type ColumnCategory = 'todo' | 'doing' | 'done'

export function columnCategory(column: BoardColumn, columns: BoardColumn[]): ColumnCategory {
  if (column.is_done) return 'done'
  const firstOpenColumn = columns.find(c => !c.is_done)
  return firstOpenColumn?.id === column.id ? 'todo' : 'doing'
}

export const COLUMN_CATEGORY_STYLES: Record<ColumnCategory, { dot: string; badge: string; accent: string }> = {
  todo:  { dot: 'bg-gray-300',  badge: 'bg-gray-100 text-gray-500',  accent: 'border-l-gray-300' },
  doing: { dot: 'bg-blue-400',  badge: 'bg-blue-50 text-blue-600',   accent: 'border-l-blue-400' },
  done:  { dot: 'bg-green-400', badge: 'bg-green-50 text-green-600', accent: 'border-l-green-400' },
}

export type ColumnOption = { id: string; name: string }
export type MemberOption = { id: string; name: string }
export type AnnouncementOption = { id: string; title: string }

export const PRIORITY_STYLES: Record<BoardCard['priority'], { label: string; className: string }> = {
  baixa: { label: 'Baixa', className: 'bg-gray-100 text-gray-600' },
  media: { label: 'Média', className: 'bg-blue-50 text-blue-600' },
  alta: { label: 'Alta', className: 'bg-red-50 text-red-600' },
}

// Paleta fixa pra etiquetas — a cor de cada uma é derivada do próprio texto
// (hash simples), então a mesma etiqueta ("urgente", "design"...) sempre
// sai com a mesma cor em qualquer card, sem precisar de uma tabela nova só
// pra guardar "nome da etiqueta → cor".
const LABEL_COLORS = [
  'bg-red-50 text-red-700',
  'bg-orange-50 text-orange-700',
  'bg-amber-50 text-amber-700',
  'bg-green-50 text-green-700',
  'bg-teal-50 text-teal-700',
  'bg-blue-50 text-blue-700',
  'bg-indigo-50 text-indigo-700',
  'bg-purple-50 text-purple-700',
  'bg-pink-50 text-pink-700',
]

export function labelColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  return LABEL_COLORS[hash % LABEL_COLORS.length]
}
