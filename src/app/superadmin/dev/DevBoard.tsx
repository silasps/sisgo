'use client'

import { useState, useTransition } from 'react'
import { updateFeedbackStatus, deleteFeedback } from './actions'
import { Modal } from '@/components/ui/Modal'
import {
  Lightbulb, Settings, CheckCircle2, Trash2,
  ChevronLeft, ChevronRight, ArrowRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Status = 'novo' | 'em_andamento' | 'feito' | 'descartado'
type Feedback = {
  id: string
  page_path: string
  page_label: string | null
  suggestion: string
  created_at: string
  status: Status
}

const COLUMNS: { status: Status; label: string; icon: LucideIcon; headerColor: string; emptyMsg: string }[] = [
  { status: 'novo',         label: 'Novos',        icon: Lightbulb,    headerColor: 'border-blue-400 bg-blue-50',   emptyMsg: 'Nenhuma sugestão nova' },
  { status: 'em_andamento', label: 'Em andamento', icon: Settings,     headerColor: 'border-amber-400 bg-amber-50', emptyMsg: 'Nada em andamento' },
  { status: 'feito',        label: 'Feitos',        icon: CheckCircle2, headerColor: 'border-green-400 bg-green-50', emptyMsg: 'Nada concluído ainda' },
  { status: 'descartado',   label: 'Descartados',  icon: Trash2,       headerColor: 'border-gray-300 bg-gray-50',  emptyMsg: 'Nada descartado' },
]

const STATUS_CFG: Record<Status, { label: string; pill: string }> = {
  novo:         { label: 'Novo',         pill: 'bg-blue-100 text-blue-700' },
  em_andamento: { label: 'Em andamento', pill: 'bg-amber-100 text-amber-700' },
  feito:        { label: 'Feito',        pill: 'bg-green-100 text-green-700' },
  descartado:   { label: 'Descartado',   pill: 'bg-gray-100 text-gray-500' },
}

const STATUS_ORDER: Status[] = ['novo', 'em_andamento', 'feito', 'descartado']

// Logical advancement actions per status — primary action first
const ACTIONS: Record<Status, { to: Status; label: string; primary?: boolean }[]> = {
  novo:         [
    { to: 'em_andamento', label: 'Iniciar',           primary: true },
    { to: 'feito',        label: 'Marcar como feito' },
    { to: 'descartado',   label: 'Descartar' },
  ],
  em_andamento: [
    { to: 'feito',        label: 'Concluir',           primary: true },
    { to: 'descartado',   label: 'Descartar' },
    { to: 'novo',         label: 'Voltar para novo' },
  ],
  feito:        [
    { to: 'em_andamento', label: 'Reabrir' },
    { to: 'descartado',   label: 'Descartar' },
  ],
  descartado:   [
    { to: 'novo',         label: 'Restaurar',          primary: true },
    { to: 'em_andamento', label: 'Iniciar' },
  ],
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' às '
    + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function cardDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function pageLabel(item: Feedback) {
  return item.page_label || item.page_path.split('/').filter(Boolean).pop() || '—'
}

export function DevBoard({ initialItems }: { initialItems: Feedback[] }) {
  const [items, setItems] = useState(initialItems)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  const orderedItems = STATUS_ORDER.flatMap(s => items.filter(i => (i.status ?? 'novo') === s))
  const selectedIndex = selectedId ? orderedItems.findIndex(i => i.id === selectedId) : -1
  const selected = selectedIndex >= 0 ? orderedItems[selectedIndex] : null

  const grouped = Object.fromEntries(
    COLUMNS.map(c => [c.status, items.filter(i => (i.status ?? 'novo') === c.status)])
  ) as Record<Status, Feedback[]>

  function open(id: string) {
    setSelectedId(id)
    setConfirmDelete(false)
  }

  function close() {
    setSelectedId(null)
    setConfirmDelete(false)
  }

  function goTo(idx: number) {
    setSelectedId(orderedItems[idx].id)
    setConfirmDelete(false)
  }

  function handleStatus(id: string, status: Status) {
    startTransition(async () => {
      await updateFeedbackStatus(id, status)
      setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteFeedback(id)
      const nextId = selectedIndex < orderedItems.length - 1
        ? orderedItems[selectedIndex + 1].id
        : selectedIndex > 0
          ? orderedItems[selectedIndex - 1].id
          : null
      setItems(prev => prev.filter(i => i.id !== id))
      setSelectedId(nextId)
      setConfirmDelete(false)
    })
  }

  return (
    <>
      {/* Detail modal */}
      {selected && (
        <Modal
          open
          onClose={close}
          title={pageLabel(selected)}
          subtitle={selected.page_path}
          hideFooter
        >
          <div className={`transition-opacity ${pending ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Meta row */}
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_CFG[selected.status].pill}`}>
                {STATUS_CFG[selected.status].label}
              </span>
              <span className="text-xs text-gray-400">{formatDate(selected.created_at)}</span>
            </div>

            {/* Suggestion */}
            <div className="mx-5 my-3 bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{selected.suggestion}</p>
            </div>

            {/* Actions */}
            <div className="px-5 pb-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Avançar para</p>
              <div className="flex flex-wrap gap-2">
                {ACTIONS[selected.status].map(action => (
                  <button
                    key={action.to}
                    onClick={() => handleStatus(selected.id, action.to)}
                    disabled={pending}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
                      action.primary
                        ? 'bg-gray-900 text-white hover:bg-gray-700'
                        : `${STATUS_CFG[action.to].pill} hover:opacity-75`
                    }`}
                  >
                    <ArrowRight className="size-3.5" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Delete */}
            <div className="px-5 pb-5">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-gray-300 hover:text-red-400 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="size-3" /> Excluir permanentemente
                </button>
              ) : (
                <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-red-600 flex-1">Excluir permanentemente?</p>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    disabled={pending}
                    className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-40"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </div>

            {/* Navigation footer */}
            <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-2">
              <button
                onClick={() => goTo(selectedIndex - 1)}
                disabled={selectedIndex === 0}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-25 transition-colors"
                title="Anterior"
              >
                <ChevronLeft className="size-4 text-gray-600" />
              </button>
              <span className="flex-1 text-center text-xs text-gray-400">
                {selectedIndex + 1} de {orderedItems.length}
              </span>
              <button
                onClick={() => goTo(selectedIndex + 1)}
                disabled={selectedIndex === orderedItems.length - 1}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 disabled:opacity-25 transition-colors text-gray-700"
                title="Próxima task"
              >
                Próxima <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Kanban */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 animate-stagger">
        {COLUMNS.map(col => (
          <div key={col.status} className="flex flex-col gap-3">
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-l-4 ${col.headerColor}`}>
              <col.icon className="size-4" />
              <span className="font-bold text-sm text-gray-800">{col.label}</span>
              <span className="ml-auto text-xs font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full shadow-sm">
                {grouped[col.status].length}
              </span>
            </div>

            {grouped[col.status].length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-8 text-center">
                <p className="text-xs text-gray-400">{col.emptyMsg}</p>
              </div>
            ) : (
              grouped[col.status].map(item => (
                <button
                  key={item.id}
                  onClick={() => open(item.id)}
                  className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 shadow-sm text-left w-full hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_CFG[item.status].pill} shrink-0`}>
                      {pageLabel(item)}
                    </span>
                    <span className="text-xs text-gray-300 shrink-0">{cardDate(item.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{item.suggestion}</p>
                </button>
              ))
            )}
          </div>
        ))}
      </div>
    </>
  )
}
