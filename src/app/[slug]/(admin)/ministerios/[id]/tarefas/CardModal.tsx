'use client'

import { useRef } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton'
import { LabelsInput } from './LabelsInput'
import type { BoardCard, ColumnOption, MemberOption, AnnouncementOption } from './types'

const PRIORITIES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
]

export function CardModal({
  open, onClose, card, defaultColumnId, columns, members, announcements,
  createAction, updateAction, deleteAction, organizationId, path,
}: {
  open: boolean
  onClose: () => void
  /** null/undefined = criando um card novo */
  card?: BoardCard | null
  /** coluna alvo ao criar (ex.: clicou em "+" numa coluna específica) */
  defaultColumnId?: string
  columns: ColumnOption[]
  members: MemberOption[]
  announcements: AnnouncementOption[]
  createAction: (formData: FormData) => Promise<void>
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => Promise<void>
  organizationId: string
  path: string
}) {
  const isEdit = !!card
  const formRef = useRef<HTMLFormElement>(null)

  async function submit(formData: FormData) {
    try {
      await (isEdit ? updateAction : createAction)(formData)
      toast.success(isEdit ? 'Tarefa atualizada.' : 'Tarefa criada.')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a tarefa.')
    }
  }

  async function handleDelete(formData: FormData) {
    try {
      await deleteAction(formData)
      toast.success('Tarefa excluída.')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir a tarefa.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar tarefa' : 'Nova tarefa'} hideFooter>
      <form ref={formRef} key={card?.id ?? 'new'} action={submit} className="p-5 space-y-3">
        {isEdit ? (
          <input type="hidden" name="card_id" value={card.id} />
        ) : (
          <input type="hidden" name="organization_id" value={organizationId} />
        )}
        <input type="hidden" name="path" value={path} />

        <input
          name="title"
          placeholder="Título da tarefa"
          required
          autoFocus
          defaultValue={card?.title ?? ''}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <textarea
          name="description"
          placeholder="Descrição (opcional)"
          rows={3}
          defaultValue={card?.description ?? ''}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
        />

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Coluna</label>
            <select
              name="column_id"
              defaultValue={card?.column_id ?? defaultColumnId ?? columns[0]?.id}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Prioridade</label>
            <select
              name="priority"
              defaultValue={card?.priority ?? 'media'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Responsável</label>
            <select
              name="assignee_person_id"
              defaultValue={card?.assignee_person_id ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="">Sem responsável</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Prazo</label>
            <input
              type="date"
              name="due_date"
              defaultValue={card?.due_date ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Etiquetas</label>
          <LabelsInput name="labels" defaultValue={card?.labels} />
        </div>

        {announcements.length > 0 && (
          <div>
            <label className="mb-1 block text-xs text-gray-500">Vincular a um anúncio (opcional)</label>
            <select
              name="announcement_id"
              defaultValue={card?.announcement_id ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="">Nenhum</option>
              {announcements.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
        )}

        <SubmitButton
          className="w-full py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
          pendingText={isEdit ? 'Salvando…' : 'Criando…'}
        >
          {isEdit ? 'Salvar alterações' : 'Criar tarefa'}
        </SubmitButton>
      </form>

      {isEdit && (
        <div className="px-5 pb-5 -mt-2">
          <form action={handleDelete}>
            <input type="hidden" name="card_id" value={card.id} />
            <input type="hidden" name="path" value={path} />
            <ConfirmSubmitButton
              confirmMessage={`Excluir a tarefa "${card.title}"? Essa ação não pode ser desfeita.`}
              className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 hover:underline font-medium"
            >
              <Trash2 size={13} /> Excluir esta tarefa
            </ConfirmSubmitButton>
          </form>
        </div>
      )}
    </Modal>
  )
}
