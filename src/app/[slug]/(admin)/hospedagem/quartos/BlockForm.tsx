'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { SubmitButton } from '@/components/ui/SubmitButton'

type Props = {
  createAction: (formData: FormData) => Promise<void>
  editAction: (formData: FormData) => Promise<void>
  block?: { id: string; name: string } | null
  trigger?: React.ReactNode
}

export function BlockForm({ createAction, editAction, block, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [justCreated, setJustCreated] = useState(false)
  const isEdit = !!block
  const formRef = useRef<HTMLFormElement>(null)

  // Sem redirect no server action. Criar limpa o formulário e deixa o modal
  // aberto (pra cadastrar vários blocos em sequência sem reabrir) — como o
  // modal continua na frente, o toast (que fica atrás do blur do backdrop)
  // não é confiável aqui, então a confirmação de "criado" é um aviso dentro
  // do próprio modal. Editar fecha (ação pontual), aí o toast já basta.
  async function submit(formData: FormData) {
    try {
      await (isEdit ? editAction : createAction)(formData)
      if (isEdit) {
        toast.success('Bloco atualizado.')
        setOpen(false)
      } else {
        formRef.current?.reset()
        formRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus()
        setJustCreated(true)
        setTimeout(() => setJustCreated(false), 2500)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar o bloco.')
    }
  }

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
        <form ref={formRef} action={submit} className="p-5 space-y-4">
          {isEdit && <input type="hidden" name="id" value={block.id} />}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome do bloco *</label>
            <input
              name="name"
              required
              autoFocus
              defaultValue={block?.name ?? ''}
              placeholder="Ex: Bloco A, Prédio Principal"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          {justCreated && (
            <p className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 size={16} /> Bloco criado — pode cadastrar o próximo.
            </p>
          )}
          <SubmitButton pendingText={isEdit ? 'Salvando…' : 'Criando…'}>
            {isEdit ? 'Salvar' : 'Criar bloco'}
          </SubmitButton>
        </form>
      </Modal>
    </>
  )
}
