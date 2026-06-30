'use client'

import { useState, useTransition } from 'react'
import { X, CalendarOff } from 'lucide-react'
import { toast } from 'sonner'
import { declareAbsence, cancelAbsence } from './ausencia-actions'

type StaffPerson = { person_id: string; full_name: string }

type UpcomingDeclaration = {
  id: string
  person_id: string
  full_name: string
  start_date: string
  end_date: string
  reason_type: string
  reason_notes: string | null
}

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  viagem_missionaria: { label: 'Viagem missionária', color: 'bg-blue-50 text-blue-700' },
  ferias:             { label: 'Férias',              color: 'bg-amber-50 text-amber-700' },
  saude:              { label: 'Saúde',               color: 'bg-red-50 text-red-600' },
  familia:            { label: 'Família',             color: 'bg-purple-50 text-purple-700' },
  outro:              { label: 'Outro',               color: 'bg-gray-100 text-gray-600' },
}

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function AusenciaModal({
  staff, orgId, slug, upcoming,
}: {
  staff: StaffPerson[]
  orgId: string
  slug: string
  upcoming: UpcomingDeclaration[]
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const today = new Date().toISOString().slice(0, 10)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('org_id', orgId)
    fd.set('slug', slug)
    startTransition(async () => {
      await declareAbsence(fd)
      toast.success('Ausência declarada com sucesso')
      setOpen(false)
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <CalendarOff size={14} />
        Declarar ausência
      </button>

      {open && (
        <div
          className="fixed inset-0 md:left-60 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-gray-900">Declarar ausência</h2>
                <p className="mt-0.5 text-xs text-gray-500">Avise o DH com antecedência</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Obreiro</label>
                <select
                  name="person_id"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="">Selecionar...</option>
                  {staff.map(s => (
                    <option key={s.person_id} value={s.person_id}>{s.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">De</label>
                  <input
                    type="date"
                    name="start_date"
                    required
                    min={today}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Até</label>
                  <input
                    type="date"
                    name="end_date"
                    required
                    min={today}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Motivo</label>
                <select
                  name="reason_type"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="">Selecionar...</option>
                  {Object.entries(REASON_LABELS).map(([value, { label }]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Observações <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <textarea
                  name="reason_notes"
                  rows={3}
                  placeholder="Detalhes adicionais..."
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
                >
                  {isPending ? 'Salvando…' : 'Declarar ausência'}
                </button>
              </div>
            </form>

            {/* Próximas ausências */}
            {upcoming.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Ausências programadas
                </p>
                <div className="space-y-2">
                  {upcoming.map(d => {
                    const r = REASON_LABELS[d.reason_type] ?? REASON_LABELS.outro
                    return (
                      <UpcomingRow key={d.id} declaration={d} orgId={orgId} slug={slug} reasonColor={r.color} reasonLabel={r.label} />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function UpcomingRow({
  declaration, orgId, slug, reasonColor, reasonLabel,
}: {
  declaration: UpcomingDeclaration
  orgId: string
  slug: string
  reasonColor: string
  reasonLabel: string
}) {
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    const fd = new FormData()
    fd.set('id', declaration.id)
    fd.set('org_id', orgId)
    fd.set('slug', slug)
    startTransition(async () => {
      await cancelAbsence(fd)
      toast.success('Ausência cancelada')
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{declaration.full_name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${reasonColor}`}>{reasonLabel}</span>
          <span className="text-xs text-gray-400">
            {formatDate(declaration.start_date)} → {formatDate(declaration.end_date)}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={isPending}
        className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
        title="Cancelar ausência"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export { REASON_LABELS }
