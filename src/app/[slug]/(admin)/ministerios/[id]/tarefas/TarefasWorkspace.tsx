'use client'

import { useMemo, useState } from 'react'
import { LayoutGrid, List as ListIcon, CalendarDays as CalIcon, Plus } from 'lucide-react'
import type { BoardColumn, BoardCard, MemberOption, AnnouncementOption } from './types'
import { KanbanBoard } from './KanbanBoard'
import { ListView } from './ListView'
import { CalendarView } from './CalendarView'
import { CardModal } from './CardModal'

type View = 'board' | 'list' | 'calendar'

type ReorderPayload = {
  updates: Array<{ id: string; columnId: string; position: number }>
  doneColumnIds: string[]
  path?: string
}

// Sem estado de cards/colunas aqui — props sempre fluem direto do server
// component (page.tsx), que refaz a query depois de qualquer mutação (as
// Server Actions chamam revalidatePath). Só o KanbanBoard mantém uma cópia
// local (sincronizada via useEffect) pro arraste responder na hora — as
// outras vistas não precisam disso.
export function TarefasWorkspace({
  unitKind, unitId, organizationId, path, isLeader, columns, cards, members, announcements,
  createColumn, renameColumn, deleteColumn, createCard, updateCard, deleteCard, reorderCards,
}: {
  /** Quadro de um ministério ou de uma escola (migration 156). */
  unitKind: 'ministerio' | 'escola'
  unitId: string
  organizationId: string
  path: string
  isLeader: boolean
  columns: BoardColumn[]
  cards: BoardCard[]
  members: MemberOption[]
  announcements: AnnouncementOption[]
  createColumn: (formData: FormData) => Promise<void>
  renameColumn: (formData: FormData) => Promise<void>
  deleteColumn: (formData: FormData) => Promise<void>
  createCard: (formData: FormData) => Promise<void>
  updateCard: (formData: FormData) => Promise<void>
  deleteCard: (formData: FormData) => Promise<void>
  reorderCards: (payload: ReorderPayload) => Promise<void>
}) {
  const [view, setView] = useState<View>('board')
  const [modalState, setModalState] = useState<{ card: BoardCard | null; columnId?: string } | null>(null)

  const columnOptions = useMemo(() => columns.map(c => ({ id: c.id, name: c.name })), [columns])
  const memberNameById = useMemo(() => new Map(members.map(m => [m.id, m.name])), [members])

  const VIEW_TABS: { key: View; label: string; icon: typeof LayoutGrid }[] = [
    { key: 'board', label: 'Quadro', icon: LayoutGrid },
    { key: 'list', label: 'Lista', icon: ListIcon },
    { key: 'calendar', label: 'Calendário', icon: CalIcon },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
          {VIEW_TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === t.key ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setModalState({ card: null, columnId: columns[0]?.id })}
          disabled={columns.length === 0}
          title={columns.length === 0 ? 'Crie uma coluna primeiro' : undefined}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} /> Nova tarefa
        </button>
      </div>

      {view === 'board' && (
        <KanbanBoard
          unitKind={unitKind}
          unitId={unitId}
          columns={columns}
          cards={cards}
          isLeader={isLeader}
          organizationId={organizationId}
          path={path}
          memberNameById={memberNameById}
          onCardClick={card => setModalState({ card })}
          onAddCard={columnId => setModalState({ card: null, columnId })}
          createColumnAction={createColumn}
          renameColumnAction={renameColumn}
          deleteColumnAction={deleteColumn}
          reorderCardsAction={reorderCards}
        />
      )}
      {view === 'list' && (
        <ListView columns={columns} cards={cards} memberNameById={memberNameById} onCardClick={card => setModalState({ card })} />
      )}
      {view === 'calendar' && (
        <CalendarView cards={cards} memberNameById={memberNameById} onCardClick={card => setModalState({ card })} />
      )}

      {modalState && (
        <CardModal
          open
          onClose={() => setModalState(null)}
          card={modalState.card}
          defaultColumnId={modalState.columnId}
          columns={columnOptions}
          members={members}
          announcements={announcements}
          createAction={createCard}
          updateAction={updateCard}
          deleteAction={deleteCard}
          organizationId={organizationId}
          path={path}
        />
      )}
    </div>
  )
}
