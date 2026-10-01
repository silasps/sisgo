'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, closestCorners, useDroppable,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, MoreVertical, User, CalendarDays, Kanban } from 'lucide-react'
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton'
import { SubmitButton } from '@/components/ui/SubmitButton'
import type { BoardColumn, BoardCard, ColumnCategory } from './types'
import { PRIORITY_STYLES, labelColor, columnCategory, COLUMN_CATEGORY_STYLES } from './types'

type ReorderPayload = {
  updates: Array<{ id: string; columnId: string; position: number }>
  doneColumnIds: string[]
  path?: string
}

type Props = {
  unitKind: 'ministerio' | 'escola'
  unitId: string
  columns: BoardColumn[]
  cards: BoardCard[]
  isLeader: boolean
  organizationId: string
  path: string
  memberNameById: Map<string, string>
  onCardClick: (card: BoardCard) => void
  onAddCard: (columnId: string) => void
  createColumnAction: (formData: FormData) => Promise<void>
  renameColumnAction: (formData: FormData) => Promise<void>
  deleteColumnAction: (formData: FormData) => Promise<void>
  reorderCardsAction: (payload: ReorderPayload) => Promise<void>
}

// Estado local espelha as props (sincronizado via useEffect) — precisa ser
// "otimista" durante o arraste (resposta visual instantânea, sem esperar o
// servidor), mas nunca pode divergir de vez das props: qualquer mutação que
// não seja drag (criar/editar/excluir pelo modal) passa por
// revalidatePath e chega aqui como prop nova, e o efeito resincroniza.
export function KanbanBoard({
  unitKind, unitId, columns, cards, isLeader, organizationId, path, memberNameById,
  onCardClick, onAddCard, createColumnAction, renameColumnAction, deleteColumnAction, reorderCardsAction,
}: Props) {
  const [localCards, setLocalCards] = useState(cards)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => setLocalCards(cards), [cards])

  const doneColumnIds = useMemo(() => columns.filter(c => c.is_done).map(c => c.id), [columns])

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, BoardCard[]>()
    for (const col of columns) map.set(col.id, [])
    for (const card of [...localCards].sort((a, b) => a.position - b.position)) {
      map.get(card.column_id)?.push(card)
    }
    return map
  }, [localCards, columns])

  // Mouse: um leve arrasto (5px) já inicia o drag — não tem conflito com
  // nada. Touch: precisa de um toque seguro (~200ms) antes de virar drag,
  // senão qualquer rolagem vertical que comece em cima de um card seria
  // capturada como arraste (o card tem touch-action:none pra permitir o
  // dnd-kit, o que também bloqueia o scroll nativo do celular). O delay dá
  // tempo de distinguir "quero rolar a tela" de "quero arrastar o card".
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )
  const activeCard = activeId ? localCards.find(c => c.id === activeId) ?? null : null
  const activeCardColumn = activeCard ? columns.find(c => c.id === activeCard.column_id) : undefined

  function findColumnOf(cardId: string): string | undefined {
    return localCards.find(c => c.id === cardId)?.column_id
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const activeCardId = String(active.id)
    const overId = String(over.id)
    const fromColumn = findColumnOf(activeCardId)
    const toColumn = columns.some(c => c.id === overId) ? overId : findColumnOf(overId)
    if (!fromColumn || !toColumn || fromColumn === toColumn) return

    setLocalCards(prev => {
      const moving = prev.find(c => c.id === activeCardId)
      if (!moving) return prev
      const rest = prev.filter(c => c.id !== activeCardId)
      return [...rest, { ...moving, column_id: toColumn }]
    })
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over) return
    const activeCardId = String(active.id)
    const overId = String(over.id)
    const toColumn = columns.some(c => c.id === overId) ? overId : findColumnOf(overId)
    if (!toColumn) return

    // Computa a nova ordem a partir do estado atual (não do updater de
    // setLocalCards) de propósito: chamar startTransition/a Server Action
    // de dentro de um updater dispara "Cannot update a component while
    // rendering" (updaters rodam na fase de render, e no StrictMode podem
    // ser invocados 2x — foi o que causava o card fantasma duplicado).
    const inTarget = localCards.filter(c => c.column_id === toColumn)
    const oldIndex = inTarget.findIndex(c => c.id === activeCardId)
    const overIndex = inTarget.findIndex(c => c.id === overId)
    const reordered = oldIndex === -1
      ? inTarget
      : arrayMove(inTarget, oldIndex, overIndex === -1 ? inTarget.length - 1 : overIndex)
    const next = localCards.map(c => {
      if (c.column_id !== toColumn) return c
      const idx = reordered.findIndex(r => r.id === c.id)
      return idx === -1 ? c : { ...c, position: idx }
    })

    setLocalCards(next)

    const updates = reordered.map((c, i) => ({ id: c.id, columnId: toColumn, position: i }))
    // startTransition: chamado fora de um <form>, sem isso o refresh que o
    // revalidatePath dispara depois de soltar o card não conta como
    // transição pro React — ele troca o quadro inteiro pelo loading.tsx
    // da rota (skeleton) até a página inteira recarregar (uns 3-4s), em
    // vez de só atualizar por baixo dos panos mantendo o card já no lugar
    // (que o estado otimista acima já deixou certo na hora).
    startTransition(() => {
      reorderCardsAction({ updates, doneColumnIds, path }).catch(() => {
        toast.error('Não foi possível salvar a nova ordem.')
      })
    })
  }

  function handleQuickMove(card: BoardCard, columnId: string) {
    if (columnId === card.column_id) return
    const targetCount = localCards.filter(c => c.column_id === columnId).length
    setLocalCards(prev => prev.map(c => c.id === card.id ? { ...c, column_id: columnId, position: targetCount } : c))
    startTransition(() => {
      reorderCardsAction({ updates: [{ id: card.id, columnId, position: targetCount }], doneColumnIds, path }).catch(() => {
        toast.error('Não foi possível mover a tarefa.')
      })
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {columns.length === 0 && !isLeader && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
          <Kanban size={28} className="opacity-40" />
          <p className="text-sm">Nenhuma coluna criada ainda.</p>
        </div>
      )}
      <div className="flex gap-3 overflow-x-auto pb-2 items-start">
        {columns.map(col => (
          <ColumnView
            key={col.id}
            column={col}
            category={columnCategory(col, columns)}
            cards={cardsByColumn.get(col.id) ?? []}
            isLeader={isLeader}
            path={path}
            memberNameById={memberNameById}
            onCardClick={onCardClick}
            onAddCard={onAddCard}
            onQuickMove={handleQuickMove}
            otherColumns={columns.filter(c => c.id !== col.id)}
            renameColumnAction={renameColumnAction}
            deleteColumnAction={deleteColumnAction}
          />
        ))}

        {isLeader && (
          <div className="shrink-0 w-64">
            {addingColumn ? (
              <form
                action={async (formData) => {
                  try {
                    await createColumnAction(formData)
                    setAddingColumn(false)
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Não foi possível criar a coluna.')
                  }
                }}
                className="bg-white rounded-xl border border-gray-200 p-2 space-y-2"
              >
                <input type="hidden" name="unit_kind" value={unitKind} />
                <input type="hidden" name="unit_id" value={unitId} />
                <input type="hidden" name="organization_id" value={organizationId} />
                <input type="hidden" name="path" value={path} />
                <input
                  name="name"
                  autoFocus
                  required
                  placeholder="Nome da coluna"
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <div className="flex gap-2">
                  <SubmitButton
                    className="flex-1 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                    pendingText="Adicionando…"
                  >
                    Adicionar
                  </SubmitButton>
                  <button type="button" onClick={() => setAddingColumn(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingColumn(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors"
              >
                <Plus size={15} /> Nova coluna
              </button>
            )}
          </div>
        )}
      </div>

      <DragOverlay>
        {activeCard && activeCardColumn && (
          <CardTile
            card={activeCard}
            category={columnCategory(activeCardColumn, columns)}
            memberNameById={memberNameById}
            dragging
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}

function ColumnView({
  column, category, cards, isLeader, path, memberNameById, onCardClick, onAddCard, onQuickMove, otherColumns,
  renameColumnAction, deleteColumnAction,
}: {
  column: BoardColumn
  category: ColumnCategory
  cards: BoardCard[]
  isLeader: boolean
  path: string
  memberNameById: Map<string, string>
  onCardClick: (card: BoardCard) => void
  onAddCard: (columnId: string) => void
  onQuickMove: (card: BoardCard, columnId: string) => void
  otherColumns: BoardColumn[]
  renameColumnAction: (formData: FormData) => Promise<void>
  deleteColumnAction: (formData: FormData) => Promise<void>
}) {
  const style = COLUMN_CATEGORY_STYLES[category]
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)

  return (
    <div className="flex-1 min-w-64 max-w-sm flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        {renaming ? (
          <form
            action={async formData => {
              try {
                await renameColumnAction(formData)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Não foi possível renomear a coluna.')
              }
              setRenaming(false)
            }}
            className="flex-1 flex items-center gap-1"
          >
            <input type="hidden" name="column_id" value={column.id} />
            <input type="hidden" name="path" value={path} />
            <input
              name="name"
              autoFocus
              defaultValue={column.name}
              onBlur={e => e.currentTarget.form?.requestSubmit()}
              className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </form>
        ) : (
          <>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`size-1.5 rounded-full shrink-0 ${style.dot}`} />
              <p className="font-semibold text-sm text-gray-800 truncate">{column.name}</p>
              <span className={`text-xs font-medium rounded-full px-1.5 ${style.badge}`}>{cards.length}</span>
            </div>
            {isLeader && (
              <div className="relative shrink-0">
                <button type="button" onClick={() => setMenuOpen(o => !o)} className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <MoreVertical size={14} />
                </button>
                {menuOpen && (
                  <>
                    {/* Overlay invisível: clicar em qualquer lugar fora do menu fecha — mesmo padrão de InscricoesList.tsx/MuralClient.tsx. */}
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-32 text-sm">
                      <button type="button" onClick={() => { setRenaming(true); setMenuOpen(false) }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">
                        Renomear
                      </button>
                      <form action={deleteColumnAction}>
                        <input type="hidden" name="column_id" value={column.id} />
                        <input type="hidden" name="path" value={path} />
                        <ConfirmSubmitButton
                          confirmMessage={`Excluir a coluna "${column.name}"? As tarefas dela também serão excluídas.`}
                          className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-500"
                        >
                          Excluir
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex flex-col gap-2 min-h-16 rounded-xl p-1.5 transition-colors ${isOver ? 'bg-brand-50' : ''}`}
        >
          {cards.map(card => (
            <SortableCard
              key={card.id}
              card={card}
              category={category}
              memberNameById={memberNameById}
              onClick={() => onCardClick(card)}
              otherColumns={otherColumns}
              onQuickMove={onQuickMove}
            />
          ))}
        </div>
      </SortableContext>

      <button
        type="button"
        onClick={() => onAddCard(column.id)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
      >
        <Plus size={13} /> Adicionar tarefa
      </button>
    </div>
  )
}

function SortableCard({ card, category, memberNameById, onClick, otherColumns, onQuickMove }: {
  card: BoardCard
  category: ColumnCategory
  memberNameById: Map<string, string>
  onClick: () => void
  otherColumns: BoardColumn[]
  onQuickMove: (card: BoardCard, columnId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <CardTile
        card={card}
        category={category}
        memberNameById={memberNameById}
        otherColumns={otherColumns}
        onQuickMove={onQuickMove}
      />
    </div>
  )
}

function CardTile({ card, category, memberNameById, dragging, otherColumns, onQuickMove }: {
  card: BoardCard
  category: ColumnCategory
  memberNameById: Map<string, string>
  dragging?: boolean
  otherColumns?: BoardColumn[]
  onQuickMove?: (card: BoardCard, columnId: string) => void
}) {
  const priority = PRIORITY_STYLES[card.priority]
  const assigneeName = card.assignee_person_id ? memberNameById.get(card.assignee_person_id) : null
  const isDone = category === 'done'
  const overdue = !isDone && card.due_date && new Date(`${card.due_date}T23:59:59`).getTime() < Date.now()

  return (
    // O card inteiro é a superfície de arraste (attributes/listeners do dnd-kit
    // ficam no wrapper em SortableCard) — não só um ícone de "alça". O
    // PointerSensor com activationConstraint distance:5 (ver KanbanBoard)
    // distingue um clique (abre o modal) de um arraste de verdade sem
    // precisar de um handle separado.
    //
    // Faixa à esquerda (border-l) reflete a categoria da coluna atual — a
    // mesma leitura de "status category" do Jira/ClickUp (a fazer/fazendo/
    // concluído), só que inferida da posição da coluna em vez de configurada
    // à parte (ver columnCategory em types.ts).
    <div className={`group bg-white rounded-lg border border-gray-200 border-l-4 ${COLUMN_CATEGORY_STYLES[category].accent} p-2.5 space-y-1.5 cursor-grab active:cursor-grabbing touch-none select-none ${dragging ? 'shadow-lg' : 'hover:border-gray-300 hover:shadow-sm'} ${isDone ? 'opacity-70' : ''} transition-all`}>
      <p className={`text-sm leading-snug ${isDone ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{card.title}</p>
      {card.labels && card.labels.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {card.labels.map(l => (
            <span key={l} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${labelColor(l)}`}>{l}</span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${priority.className}`}>{priority.label}</span>
        {assigneeName && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <User size={11} /> {assigneeName.split(' ')[0]}
          </span>
        )}
        {card.due_date && (
          <span className={`inline-flex items-center gap-1 text-[11px] ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            <CalendarDays size={11} /> {new Date(`${card.due_date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </span>
        )}
        {otherColumns && otherColumns.length > 0 && onQuickMove && (
          <select
            value=""
            onChange={e => { if (e.target.value) onQuickMove(card, e.target.value) }}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            className="ml-auto text-[10px] text-gray-400 border-0 bg-transparent focus:outline-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            title="Mover para outra coluna — alternativa a arrastar"
            aria-label="Mover tarefa para outra coluna"
          >
            <option value="">Mover para…</option>
            {otherColumns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}
