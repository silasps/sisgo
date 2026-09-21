'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { SubmitButton } from '@/components/ui/SubmitButton'

const BED_TYPES = [
  { value: 'solteiro', label: 'Solteiro' },
  { value: 'casal', label: 'Casal' },
  { value: 'beliche_sup', label: 'Beliche Superior' },
  { value: 'beliche_inf', label: 'Beliche Inferior' },
  { value: 'colchao', label: 'Colchão' },
] as const

const BED_STATUS = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'ocupada', label: 'Ocupada' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'reservada', label: 'Reservada' },
] as const

type BedData = { id: string; label: string; type: string; status: string; notes: string | null }

type Props = {
  createAction: (formData: FormData) => Promise<void>
  editAction?: (formData: FormData) => Promise<void>
  roomId: string
  bed?: BedData | null
  trigger?: React.ReactNode
}

// Criação e edição rápida de cama a partir do drill-down (QuartosExplorer) —
// check-in/checkout e alocação continuam só na página completa do quarto.
export function BedForm({ createAction, editAction, roomId, bed, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [justCreated, setJustCreated] = useState(false)
  const isEdit = !!bed
  const formRef = useRef<HTMLFormElement>(null)

  // Criar deixa o modal aberto (pra cadastrar várias camas seguidas) — o
  // toast fica atrás do blur do backdrop nesse caso, então a confirmação é
  // um aviso dentro do próprio modal. Editar fecha, ação pontual num item só.
  async function submit(formData: FormData) {
    try {
      if (isEdit) {
        await editAction!(formData)
        toast.success('Cama atualizada.')
        setOpen(false)
      } else {
        await createAction(formData)
        formRef.current?.reset()
        formRef.current?.querySelector<HTMLInputElement>('input[name="label"]')?.focus()
        setJustCreated(true)
        setTimeout(() => setJustCreated(false), 2500)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a cama.')
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <button type="button" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
            + Cama
          </button>
        )}
      </span>

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? `Editar: ${bed.label}` : 'Nova cama'} hideFooter>
        <form ref={formRef} action={submit} className="p-5 space-y-4">
          {isEdit ? (
            <input type="hidden" name="id" value={bed.id} />
          ) : (
            <input type="hidden" name="room_id" defaultValue={roomId} />
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome/Rótulo *</label>
            <input
              name="label"
              required
              autoFocus
              defaultValue={bed?.label ?? ''}
              placeholder="Ex: Cama 1, Beliche A - Superior"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
              <select
                name="type"
                required
                defaultValue={bed?.type ?? 'solteiro'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {BED_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue={bed.status}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  {BED_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
          </div>
          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
              <textarea
                name="notes"
                rows={2}
                defaultValue={bed.notes ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              />
            </div>
          )}
          {justCreated && (
            <p className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 size={16} /> Cama criada — pode cadastrar a próxima.
            </p>
          )}
          <SubmitButton pendingText={isEdit ? 'Salvando…' : 'Criando…'}>
            {isEdit ? 'Salvar' : 'Criar cama'}
          </SubmitButton>
        </form>
      </Modal>
    </>
  )
}
