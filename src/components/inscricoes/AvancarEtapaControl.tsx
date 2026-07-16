'use client'

import { useState, useTransition } from 'react'
import type { StageAdvance } from '@/lib/pipelineStageAdvance'

type AdvanceParams = { applicationId: string; organizationId: string; slug: string; fromStage: string; toStage: string; reason: string }

export function AvancarEtapaControl({ currentStageLabel, fixed, action }: {
  currentStageLabel: string | null
  fixed: { applicationId: string; organizationId: string; slug: string }
  action: (params: AdvanceParams) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  if (!currentStageLabel) return null

  return (
    <details className="mt-2 text-xs" open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-indigo-600 font-medium select-none">Avançar etapa manualmente →</summary>
      <div className="mt-2 space-y-2 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
        <p className="text-indigo-800">
          Marca <strong>{currentStageLabel}</strong> como concluída manualmente (ex.: resolvido por fora do sistema).
          Fica registrado quem fez isso e por quê.
        </p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} required
          placeholder="Justificativa (obrigatória)"
          className="w-full rounded-lg border border-indigo-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <button type="button" disabled={pending || !reason.trim()}
          onClick={() => startTransition(async () => {
            await action({ ...fixed, fromStage: currentStageLabel, toStage: currentStageLabel, reason })
            setReason(''); setOpen(false)
          })}
          className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors">
          {pending ? 'Salvando…' : 'Confirmar avanço'}
        </button>
      </div>
    </details>
  )
}

export function AdvanceHistoryList({ advances, names }: { advances: StageAdvance[]; names: Record<string, string> }) {
  if (advances.length === 0) return null
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs font-semibold text-gray-500">Avanços manuais</p>
      {advances.map(a => (
        <div key={a.id} className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
          <p className="text-amber-800">
            <strong>{a.to_stage}</strong> — {names[a.advanced_by ?? ''] ?? 'um administrador'} ·{' '}
            {new Date(a.advanced_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
          <p className="text-amber-700 mt-0.5">{a.reason}</p>
        </div>
      ))}
    </div>
  )
}
