'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserX } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TERMINATION_REASON_LABELS } from '@/lib/staff/terminationPolicy'

type Props = {
  fullName: string
  slug: string
  personId: string
  action: (formData: FormData) => Promise<{ error: string } | { ok: true; terminationId: string }>
}

// Desligamento formal — revoga acesso, registra motivo e gera o termo
// oficial (ver página /desligamento/[terminationId]). Diferente de
// "Remover acesso": aqui fica um registro permanente de QUE e POR QUE a
// pessoa foi desligada — Remover acesso só desfaz uma criação de login.
export function DesligarObreiroCard({ fullName, slug, personId, action }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reasonCategory, setReasonCategory] = useState('')
  const [reasonText, setReasonText] = useState('')
  const [hadPriorConversation, setHadPriorConversation] = useState(false)
  const [lastUnitLabel, setLastUnitLabel] = useState('')
  const [leaderName, setLeaderName] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    const fd = new FormData()
    fd.set('reason_category', reasonCategory)
    fd.set('reason_text', reasonText)
    if (hadPriorConversation) fd.set('had_prior_conversation', 'on')
    fd.set('last_unit_label', lastUnitLabel)
    fd.set('leader_name', leaderName)
    startTransition(async () => {
      const res = await action(fd)
      if ('error' in res) { toast.error(res.error); return }
      router.push(`/${slug}/pessoas/${personId}/desligamento/${res.terminationId}`)
    })
  }

  return (
    <div className="bg-white rounded-xl border border-red-100 p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Desligar obreiro</h2>
      <p className="text-xs text-gray-400 mb-3">
        Revoga o acesso dela na hora e gera o termo oficial de desligamento, com o motivo
        registrado. Diferente de &ldquo;Remover acesso&rdquo;: aqui o cadastro continua existindo,
        só sai de atividade.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
        >
          <UserX size={15} /> Desligar obreiro
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Motivo *</label>
            <select
              value={reasonCategory}
              onChange={e => setReasonCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="">Selecionar motivo...</option>
              {Object.entries(TERMINATION_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Detalhes (opcional)</label>
            <textarea
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Último ministério/escola</label>
              <input
                value={lastUnitLabel}
                onChange={e => setLastUnitLabel(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome do líder</label>
              <input
                value={leaderName}
                onChange={e => setLeaderName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={hadPriorConversation}
              onChange={e => setHadPriorConversation(e.target.checked)}
              className="rounded border-gray-300 text-brand-500 focus:ring-brand-400"
            />
            Houve conversa prévia com a liderança
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <ConfirmDialog
              variant="danger"
              message={`Desligar ${fullName}? O acesso dela é revogado na hora e um termo oficial de desligamento é gerado.`}
              confirmLabel="Desligar"
              onConfirm={handleSubmit}
            >
              <button
                type="button"
                disabled={!reasonCategory || isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isPending ? 'Desligando…' : 'Confirmar desligamento'}
              </button>
            </ConfirmDialog>
          </div>
        </div>
      )}
    </div>
  )
}
