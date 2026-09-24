'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'

const REASONS = [
  { value: 'saude_seguranca', label: 'Emergência de saúde/segurança' },
  { value: 'contato_urgente', label: 'Contato urgente (família/localização)' },
  { value: 'outro', label: 'Outro motivo urgente' },
]

export function EmergencyRequestForm({
  personName,
  action,
}: {
  personName: string
  action: (formData: FormData) => Promise<{ error: string } | { ok: true }>
}) {
  const router = useRouter()
  const [reasonCategory, setReasonCategory] = useState('')
  const [reasonText, setReasonText] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('reason_category', reasonCategory)
    fd.append('reason_text', reasonText)
    startTransition(async () => {
      const res = await action(fd)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Acesso liberado por 24h. Isso ficou registrado e o DH vai poder revisar.')
      router.refresh()
    })
  }

  return (
    <main className="p-4 md:p-6 max-w-2xl">
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Acesso de emergência</h2>
            <p className="text-sm text-amber-800 mt-1">
              Você não tem acesso ao perfil completo de <strong>{personName}</strong> — isso é reservado ao DH.
              Em situação de força maior (proteção da vida/segurança, ou contato urgente), você pode liberar um
              acesso limitado (contato, CPF, endereço — nunca saúde ou financeiro) por 24 horas. <strong>O motivo
              fica registrado e o DH consegue ver todo acesso de emergência feito.</strong>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Motivo</label>
            <select
              required
              value={reasonCategory}
              onChange={e => setReasonCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="" disabled>Selecionar...</option>
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Descreva a situação</label>
            <textarea
              required
              minLength={10}
              rows={3}
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              placeholder="O que está acontecendo e por que precisa desse acesso agora..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <AlertTriangle className="size-4" />}
            Liberar acesso de emergência
          </button>
        </form>
      </div>
    </main>
  )
}
