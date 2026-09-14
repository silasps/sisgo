'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { SubmitButton } from '@/components/ui/SubmitButton'

const DESTINATION_OPTIONS = [
  { value: '', label: 'Sem padrão' },
  { value: 'visita', label: 'Visitantes' },
  { value: 'aluno', label: 'Alunos' },
  { value: 'obreiro', label: 'Obreiros' },
] as const

const GENDER_OPTIONS = [
  { value: '', label: 'Sem padrão' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'misto', label: 'Misto' },
] as const

type FloorData = { id: string; name: string; destination: string | null; gender_constraint: string | null }

type Props = {
  createAction: (formData: FormData) => Promise<void>
  editAction: (formData: FormData) => Promise<void>
  blockId: string
  floor?: FloorData | null
  trigger?: React.ReactNode
}

export function FloorForm({ createAction, editAction, blockId, floor, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [justCreated, setJustCreated] = useState(false)
  const isEdit = !!floor
  const formRef = useRef<HTMLFormElement>(null)

  // Modal fica aberto ao criar (pra cadastrar vários andares seguidos) — o
  // toast fica atrás do blur do backdrop nesse caso, então a confirmação é
  // um aviso dentro do próprio modal. Editar fecha, aí o toast já basta.
  async function submit(formData: FormData) {
    try {
      await (isEdit ? editAction : createAction)(formData)
      if (isEdit) {
        toast.success('Andar atualizado.')
        setOpen(false)
      } else {
        formRef.current?.reset()
        formRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus()
        setJustCreated(true)
        setTimeout(() => setJustCreated(false), 2500)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar o andar.')
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <button type="button" className="text-xs font-medium text-brand-500 hover:text-brand-700 transition-colors">
            + Andar
          </button>
        )}
      </span>

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? 'Editar andar' : 'Novo andar'} hideFooter>
        <form ref={formRef} action={submit} className="p-5 space-y-4">
          {isEdit && <input type="hidden" name="id" value={floor.id} />}
          {/* defaultValue (não value) — precisa sobreviver a formRef.reset() */}
          <input type="hidden" name="block_id" defaultValue={blockId} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome do andar *</label>
            <input
              name="name"
              required
              autoFocus
              defaultValue={floor?.name ?? ''}
              placeholder="Ex: Térreo, 1º Andar"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            Público e gênero abaixo são só um padrão — pré-preenchem quarto novo criado neste andar, mas cada quarto pode ser diferente.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Destinado a (padrão)</label>
              <select
                name="destination"
                defaultValue={floor?.destination ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {DESTINATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gênero (padrão)</label>
              <select
                name="gender_constraint"
                defaultValue={floor?.gender_constraint ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {GENDER_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
          </div>
          {justCreated && (
            <p className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 size={16} /> Andar criado — pode cadastrar o próximo.
            </p>
          )}
          <SubmitButton pendingText={isEdit ? 'Salvando…' : 'Criando…'}>
            {isEdit ? 'Salvar' : 'Criar andar'}
          </SubmitButton>
        </form>
      </Modal>
    </>
  )
}
