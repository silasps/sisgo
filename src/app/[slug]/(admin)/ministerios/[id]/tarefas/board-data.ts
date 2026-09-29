import type { createAdminClient } from '@/lib/supabase/admin'
import type { BoardColumn, BoardCard } from './types'

// Carrega o quadro de Tarefas de um ministério OU de uma escola (mesmas
// tabelas, migration 156) — usado pelas duas páginas de Tarefas.

type Admin = ReturnType<typeof createAdminClient>
export type BoardUnitRef = { kind: 'ministerio' | 'escola'; id: string }

const DEFAULT_COLUMNS: Array<{ name: string; is_done: boolean }> = [
  { name: 'A Fazer', is_done: false },
  { name: 'Fazendo', is_done: false },
  { name: 'Concluído', is_done: true },
]

const unitKey = (unit: BoardUnitRef) => (unit.kind === 'ministerio' ? 'ministry_id' : 'school_id')

async function loadColumns(db: Admin, orgId: string, unit: BoardUnitRef): Promise<BoardColumn[]> {
  const select = () => db
    .from('ministry_board_columns')
    .select('id, name, position, is_done')
    .eq(unitKey(unit), unit.id)
    .order('position', { ascending: true })

  let { data: columnsRaw } = await select()
  if (!columnsRaw || columnsRaw.length === 0) {
    // Seed preguiçoso na primeira visita. Duas requisições concorrentes
    // podem cair aqui ao mesmo tempo (ex.: dois usuários abrindo o quadro
    // juntos) — o índice único de nome por unidade (migrations 142/156)
    // rejeita a segunda tentativa inteira (insert em lote é atômico), sem
    // problema: só relemos o que já existe.
    await db.from('ministry_board_columns').insert(
      DEFAULT_COLUMNS.map((c, i) => ({
        organization_id: orgId,
        ministry_id: unit.kind === 'ministerio' ? unit.id : null,
        school_id: unit.kind === 'escola' ? unit.id : null,
        name: c.name,
        position: i,
        is_done: c.is_done,
      }))
    )
    ;({ data: columnsRaw } = await select())
  }
  return (columnsRaw ?? []) as BoardColumn[]
}

export async function loadBoard(db: Admin, orgId: string, unit: BoardUnitRef) {
  const [columns, { data: cardsRaw }] = await Promise.all([
    loadColumns(db, orgId, unit),
    db.from('ministry_board_cards')
      .select('id, column_id, title, description, position, priority, assignee_person_id, due_date, labels, announcement_id, completed_at, created_by')
      .eq(unitKey(unit), unit.id)
      .order('position', { ascending: true }),
  ])
  return { columns, cards: (cardsRaw ?? []) as BoardCard[] }
}
