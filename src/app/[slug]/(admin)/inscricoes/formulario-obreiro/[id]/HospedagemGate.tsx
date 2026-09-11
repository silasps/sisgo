'use client'

import { useState, useTransition } from 'react'
import { pularHospedagem, reverterSkipHospedagem } from './actions'

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
  const [editing, setEditing] = useState(false)
  const [reason, setReason] = useState(skipReason ?? '')
  const [isPending, startTransition] = useTransition()
  const [localSkipReason, setLocalSkipReason] = useState(skipReason)

  if (resolved) return null

  if (localSkipReason && !editing) {
    return (
      <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <p className="font-semibold text-amber-800">Não vai se hospedar na base{skippedByName ? ` — marcado por ${skippedByName}` : ''}</p>
        {skippedAt && <p className="text-amber-600">{new Date(skippedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
        <p className="text-amber-700 mt-1 whitespace-pre-wrap">{localSkipReason}</p>
        {!readOnly && (
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={() => { setReason(localSkipReason); setEditing(true) }} className="text-amber-700 hover:text-amber-900 underline">
              Editar motivo
            </button>
            <button
              type="button" disabled={isPending}
              onClick={() => startTransition(async () => {
                await reverterSkipHospedagem({ staffApplicationId, organizationId, slug })
                setLocalSkipReason(null)
              })}
              className="text-amber-700 hover:text-amber-900 underline disabled:opacity-50"
            >
              {isPending ? 'Revertendo…' : 'Reverter — vai se hospedar na base'}
            </button>
          </div>
        )}
      </div>
    )
  }

  if (readOnly) return null

  return (
    <div className="mt-2">
      {open || editing ? (
        <div className="space-y-2">
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Justificativa obrigatória (ex.: obreiro mora fora da base e não vai precisar de hospedagem...)"
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
                setEditing(false)
              })}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? 'Salvando…' : 'Confirmar'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setEditing(false) }} className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-xs text-amber-700 hover:text-amber-900 underline">
          Marcar que não vai se hospedar na base
        </button>
      )}
    </div>
  )
}
