'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

type Props = {
  createAction: (formData: FormData) => Promise<void>
  editAction: (formData: FormData) => Promise<void>
  block?: { id: string; name: string } | null
  trigger?: React.ReactNode
}

export function BlockForm({ createAction, editAction, block, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const isEdit = !!block

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <button type="button" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
            + Novo bloco
          </button>
        )}
      </span>

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? 'Editar bloco' : 'Novo bloco'} hideFooter>
        <form action={isEdit ? editAction : createAction} className="p-5 space-y-4" onSubmit={() => setOpen(false)}>
          {isEdit && <input type="hidden" name="id" value={block.id} />}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome do bloco *</label>
            <input
              name="name"
              required
              defaultValue={block?.name ?? ''}
              placeholder="Ex: Bloco A, Prédio Principal"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <button type="submit" className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
            {isEdit ? 'Salvar' : 'Criar bloco'}
          </button>
        </form>
      </Modal>
    </>
  )
}
