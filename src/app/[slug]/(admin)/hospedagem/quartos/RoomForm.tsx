'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { rememberValue, recallValue } from './lastValues'

const ROOM_TYPES = [
  { value: 'quarto', label: 'Quarto' },
  { value: 'suite', label: 'Suíte' },
  { value: 'dormitorio', label: 'Dormitório' },
  { value: 'casal', label: 'Casal' },
] as const

const GENDER_OPTIONS = [
  { value: '', label: 'Sem restrição' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'misto', label: 'Misto' },
] as const

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'inativo', label: 'Inativo' },
] as const

const DESTINATION_OPTIONS = [
  { value: 'visita', label: 'Visitantes' },
  { value: 'aluno', label: 'Alunos' },
  { value: 'obreiro', label: 'Obreiros' },
] as const

const MODE_OPTIONS = [
  {
    value: 'quarto',
    label: 'Quarto inteiro',
    description: 'Sugestão padrão: o quarto é oferecido de uma vez só, pra uma pessoa, casal ou família. Se o quarto estiver 100% livre, ainda dá pra alocar cama a cama se precisar.',
  },
  {
    value: 'cama',
    label: 'Cama individual',
    description: 'Sugestão padrão: cada cama do quarto é oferecida separadamente, pra pessoas diferentes dividirem o mesmo quarto. Se o quarto estiver 100% livre, também dá pra alocar ele inteiro pra uma família ou grupo.',
  },
] as const

type RoomData = {
  id: string
  name: string
  floorId: string
  type: string
  gender_constraint: string | null
  destination: string
  allocation_mode: string
  status: string
  notes: string | null
}

type FloorOption = {
  id: string
  name: string
  blockName: string
  destination: string | null
  genderConstraint: string | null
}

type Props = {
  createAction: (formData: FormData) => Promise<void>
  editAction: (formData: FormData) => Promise<void>
  floors: FloorOption[]
  room?: RoomData | null
  defaultFloorId?: string
  trigger?: React.ReactNode
}

export function RoomForm({ createAction, editAction, floors, room, defaultFloorId, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [justCreated, setJustCreated] = useState(false)
  const isEdit = !!room
  const initialFloorId = room?.floorId ?? defaultFloorId ?? floors[0]?.id ?? ''
  const [floorId, setFloorId] = useState(initialFloorId)
  const [mode, setMode] = useState(room?.allocation_mode ?? recallValue('room:allocation_mode', 'cama'))
  const [resetTick, setResetTick] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  const floorsByBlock = useMemo(() => {
    const map = new Map<string, FloorOption[]>()
    for (const f of floors) map.set(f.blockName, [...(map.get(f.blockName) ?? []), f])
    return map
  }, [floors])

  // Andar carrega um público/gênero padrão — só pré-preenche o quarto NOVO
  // (troca o `key` do select pra remontar com o novo default quando o andar
  // muda); editando um quarto existente, o valor de sempre é o do próprio
  // quarto, o andar não sobrescreve nada. Se um quarto foi criado há menos de
  // 5 min, o tipo/gênero/destino dele "vence" o padrão do andar — sinal de
  // que a pessoa tá cadastrando vários quartos parecidos em sequência.
  const selectedFloor = floors.find(f => f.id === floorId)
  const typeDefault = isEdit ? (room?.type ?? 'quarto') : recallValue('room:type', 'quarto')
  const destinationDefault = isEdit ? (room?.destination ?? 'visita') : recallValue('room:destination', selectedFloor?.destination ?? 'visita')
  const genderDefault = isEdit ? (room?.gender_constraint ?? '') : recallValue('room:gender_constraint', selectedFloor?.genderConstraint ?? '')

  async function submit(formData: FormData) {
    try {
      await (isEdit ? editAction : createAction)(formData)
      if (isEdit) {
        toast.success('Quarto atualizado.')
        setOpen(false)
      } else {
        // Fica no mesmo andar e limpa só o nome/notas — tipo/gênero/destino/
        // modo ficam guardados por 5 min (lastValues.ts), pensado pra
        // cadastrar vários quartos parecidos em sequência. Modal continua
        // aberto, então a confirmação é um aviso dentro dele (o toast fica
        // atrás do blur do backdrop nesse caso).
        rememberValue('room:type', String(formData.get('type') ?? ''))
        rememberValue('room:gender_constraint', String(formData.get('gender_constraint') ?? ''))
        rememberValue('room:destination', String(formData.get('destination') ?? ''))
        rememberValue('room:allocation_mode', String(formData.get('allocation_mode') ?? ''))
        formRef.current?.reset()
        setFloorId(initialFloorId)
        setMode(recallValue('room:allocation_mode', 'cama'))
        setResetTick(t => t + 1)
        formRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus()
        setJustCreated(true)
        setTimeout(() => setJustCreated(false), 2500)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar o quarto.')
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <button
            type="button"
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Novo Quarto
          </button>
        )}
      </span>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? 'Editar Quarto' : 'Novo Quarto'}
        hideFooter
      >
        <form
          ref={formRef}
          action={submit}
          className="p-5 space-y-4"
        >
          {isEdit && <input type="hidden" name="id" value={room.id} />}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome do quarto *</label>
            <input
              name="name"
              required
              autoFocus
              defaultValue={room?.name ?? ''}
              placeholder="Ex: Quarto 101, Alojamento A"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Andar *</label>
            <select
              name="floor_id"
              required
              value={floorId}
              onChange={e => setFloorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {floors.length === 0 && <option value="">Crie um bloco e andar primeiro</option>}
              {[...floorsByBlock.entries()].map(([blockName, blockFloors]) => (
                <optgroup key={blockName} label={blockName}>
                  {blockFloors.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
              <select
                key={isEdit ? 'edit-type' : `type-${resetTick}`}
                name="type"
                required
                defaultValue={typeDefault}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {ROOM_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gênero</label>
              <select
                key={isEdit ? 'edit-gender' : `gender-${floorId}-${resetTick}`}
                name="gender_constraint"
                defaultValue={genderDefault}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {GENDER_OPTIONS.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Destinado a *</label>
            <select
              key={isEdit ? 'edit-destination' : `destination-${floorId}-${resetTick}`}
              name="destination"
              required
              defaultValue={destinationDefault}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {DESTINATION_OPTIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Modo de alocação (padrão sugerido) *</label>
            <select
              name="allocation_mode"
              required
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {MODE_OPTIONS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              {MODE_OPTIONS.find(m => m.value === mode)?.description}
            </p>
          </div>

          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                name="status"
                defaultValue={room?.status ?? 'ativo'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={room?.notes ?? ''}
              placeholder="Informações adicionais sobre o quarto..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>

          {justCreated && (
            <p className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 size={16} /> Quarto criado — pode cadastrar o próximo.
            </p>
          )}
          <SubmitButton disabled={floors.length === 0} pendingText={isEdit ? 'Salvando…' : 'Criando…'}>
            {isEdit ? 'Salvar Alterações' : 'Criar Quarto'}
          </SubmitButton>
        </form>
      </Modal>
    </>
  )
}
