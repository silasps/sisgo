'use client'

import { useState, useTransition } from 'react'
import { pularHospedagem } from './actions'

type Props = {
  staffApplicationId: string
  organizationId: string
  slug: string
  resolved: boolean
  skipReason: string | null
  skippedByName: string | null
  skippedAt: string | null
  readOnly: boolean
}

export function HospedagemGate({ staffApplicationId, organizationId, slug, resolved, skipReason, skippedByName, skippedAt, readOnly }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()
  const [localSkipReason, setLocalSkipReason] = useState(skipReason)

  if (resolved) return null

  if (localSkipReason) {
    return (
      <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <p className="font-semibold text-amber-800">Etapa pulada pelo DH{skippedByName ? ` — ${skippedByName}` : ''}</p>
        {skippedAt && <p className="text-amber-600">{new Date(skippedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
        <p className="text-amber-700 mt-1 whitespace-pre-wrap">{localSkipReason}</p>
      </div>
    )
  }

  if (readOnly) return null

  return (
    <div className="mt-2">
      {open ? (
        <div className="space-y-2">
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Justificativa obrigatória (ex.: obreiro vai residir por conta própria, não precisa de hospedagem da base...)"
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
          />
          <div className="flex gap-2">
            <button
              type="button" disabled={isPending || !reason.trim()}
              onClick={() => startTransition(async () => {
                await pularHospedagem({ staffApplicationId, organizationId, slug, reason })
                setLocalSkipReason(reason)
                setOpen(false)
              })}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? 'Salvando…' : 'Confirmar skip'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-xs text-amber-700 hover:text-amber-900 underline">
          Pular com justificativa
        </button>
      )}
    </div>
  )
}
