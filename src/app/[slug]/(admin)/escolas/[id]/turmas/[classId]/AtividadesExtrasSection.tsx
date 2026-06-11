'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { Modal } from '@/components/ui/Modal'
import { CadastrarAtividadeModal } from './CadastrarAtividadeModal'

export type Program = {
  id: string
  name: string
  description: string | null
  icon: string | null
  image_url: string | null
  additional_cost: number | null
  isSelected: boolean
}

type Props = {
  programs: Program[]
  classId: string
  orgId: string
  slug: string
  toggleAction: (fd: FormData) => Promise<void>
  editAction: (fd: FormData) => Promise<void>
  deleteAction: (fd: FormData) => Promise<void>
}

export function AtividadesExtrasSection({
  programs, classId, orgId, slug,
  toggleAction, editAction, deleteAction,
}: Props) {
  const [editing, setEditing] = useState<Program | null>(null)
  const [, startTransition] = useTransition()
  const [optimisticPrograms, updateOptimistic] = useOptimistic(
    programs,
    (state: Program[], { id, isSelected }: { id: string; isSelected: boolean }) =>
      state.map(p => p.id === id ? { ...p, isSelected } : p)
  )

  function handleToggle(prog: Program) {
    const newSelected = !prog.isSelected
    startTransition(async () => {
      updateOptimistic({ id: prog.id, isSelected: newSelected })
      const fd = new FormData()
      fd.append('program_id', prog.id)
      fd.append('class_id', classId)
      fd.append('action_type', newSelected ? 'add' : 'remove')
      await toggleAction(fd)
    })
  }

  const activeCount = optimisticPrograms.filter(p => p.isSelected).length

  return (
    <>
      <section id="atividades-extras" className="bg-white rounded-xl border border-gray-200 p-5 scroll-mt-20">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h2 className="font-semibold text-gray-900">Atividades extras</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeCount > 0
                ? `${activeCount} ativa${activeCount > 1 ? 's' : ''} nesta turma · use o toggle para ativar/desativar`
                : 'Nenhuma ativa — use o toggle para incluir nesta turma'}
            </p>
          </div>
          <CadastrarAtividadeModal orgId={orgId} slug={slug} />
        </div>

        {programs.length === 0 ? (
          <p className="text-sm text-gray-400 mt-4">
            Nenhuma atividade cadastrada ainda. Use o botão acima para adicionar a primeira.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {optimisticPrograms.map(prog => (
              <div key={prog.id}
                onClick={() => setEditing(prog)}
                className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer
                  ${prog.isSelected
                    ? 'border-brand-400 bg-gradient-to-br from-brand-50 to-indigo-50 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md hover:-translate-y-0.5'}`}>

                {/* Imagem / ícone */}
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center shadow-sm">
                  {prog.image_url
                    ? <img src={prog.image_url} alt={prog.name} className="w-full h-full object-cover" />
                    : <span className="text-2xl">{prog.icon ?? '⭐'}</span>}
                </div>

                {/* Conteúdo */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{prog.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors
                      ${prog.isSelected ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400'}`}>
                      {prog.isSelected ? 'Na turma' : 'Inativa'}
                    </span>
                  </div>
                  {prog.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{prog.description}</p>
                  )}
                  {prog.additional_cost ? (
                    <p className="text-xs font-semibold text-brand-600 mt-1">
                      + R$ {Number(prog.additional_cost).toFixed(2).replace('.', ',')}
                    </p>
                  ) : null}
                </div>

                {/* Ações: toggle + editar + excluir */}
                <div onClick={e => e.stopPropagation()} className="flex flex-col items-end gap-2.5 flex-shrink-0 ml-1">
                  {/* Toggle incluir/excluir da turma */}
                  <button type="button"
                    onClick={() => handleToggle(prog)}
                    title={prog.isSelected ? 'Remover da turma' : 'Incluir na turma'}
                    className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0
                      ${prog.isSelected ? 'bg-brand-500' : 'bg-gray-200'}`}>
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200
                      ${prog.isSelected ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>

                  {/* Editar + Excluir */}
                  <div className="flex items-center gap-0.5">
                    <button type="button" onClick={() => setEditing(prog)}
                      title="Editar atividade"
                      className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>

                    <form action={deleteAction}>
                      <input type="hidden" name="program_id" value={prog.id} />
                      <button type="submit"
                        title="Excluir atividade"
                        onClick={(e) => { if (!confirm(`Excluir "${prog.name}" permanentemente?`)) e.preventDefault() }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" /><path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal de edição */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Editar atividade"
        subtitle={editing?.name ?? ''}>
        {editing && (
          <form action={editAction} className="space-y-4 p-5">
            <input type="hidden" name="program_id" value={editing.id} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
              <input name="name" required defaultValue={editing.name}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
              <textarea name="description" rows={3} defaultValue={editing.description ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ícone (emoji)</label>
                <input name="icon" defaultValue={editing.icon ?? ''} placeholder="⭐"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Custo adicional (R$)</label>
                <input name="additional_cost" type="number" step="0.01" min="0"
                  defaultValue={editing.additional_cost?.toString() ?? ''}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setEditing(null)}
                className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit"
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors">
                Salvar alterações
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
