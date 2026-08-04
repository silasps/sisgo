'use client'

import { useState } from 'react'
import { BellRing } from 'lucide-react'

type Props = {
  cancelAction: (formData: FormData) => Promise<void>
  holdId: string
  groupName: string
  startsAt: string
  endsAt: string
  scopeLabel: string // "este bloco" | "este andar"
  backBlockId: string
  backFloorId?: string
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function HoldBanner({ cancelAction, holdId, groupName, startsAt, endsAt, scopeLabel, backBlockId, backFloorId }: Props) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <form action={cancelAction} onSubmit={() => setConfirming(false)} className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
        <input type="hidden" name="id" value={holdId} />
        <input type="hidden" name="back_block" value={backBlockId} />
        {backFloorId && <input type="hidden" name="back_floor" value={backFloorId} />}
        <p className="text-sm text-amber-800">Cancelar a reserva de {scopeLabel} pro grupo <strong>{groupName}</strong>?</p>
        <input
          name="reason"
          placeholder="Motivo do cancelamento (opcional)"
          className="w-full border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirming(false)} className="flex-1 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-white transition-colors">
            Voltar
          </button>
          <button type="submit" className="flex-1 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors">
            Confirmar cancelamento
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <BellRing size={14} className="text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800 truncate">
          Reservado pro grupo <strong>{groupName}</strong> — {fmt(startsAt)} → {fmt(endsAt)}
        </p>
      </div>
      <button type="button" onClick={() => setConfirming(true)} className="text-xs text-amber-700 hover:text-red-600 font-medium shrink-0">
        Cancelar
      </button>
    </div>
  )
}
