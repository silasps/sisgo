'use client'

import { useState, useTransition } from 'react'
import { solicitarHospedagemObreiro } from './actions'

type Props = {
  slug: string
  organizationId: string
  ministryId: string | null
  staffApplicationId: string
  guestName: string
  status: string | null
  requestedArrivalDate: string | null
  requestNotes: string | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente:   { label: 'Aguardando resposta da hospitalidade', color: 'bg-yellow-100 text-yellow-700' },
  em_analise: { label: 'Em análise pela hospitalidade',        color: 'bg-blue-100 text-blue-700' },
  em_andamento: { label: 'Em andamento',                       color: 'bg-blue-100 text-blue-700' },
  resolvido:  { label: 'Hospedagem confirmada',                color: 'bg-green-100 text-green-700' },
  rejeitado:  { label: 'Recusada pela hospitalidade',          color: 'bg-red-100 text-red-700' },
}

export function HospedagemSolicitacaoCard({
  slug, organizationId, ministryId, staffApplicationId, guestName, status, requestedArrivalDate, requestNotes,
}: Props) {
  const [arrivalDate, setArrivalDate] = useState(requestedArrivalDate ?? '')
  const [notes, setNotes] = useState(requestNotes ?? '')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  const statusInfo = status ? STATUS_LABELS[status] ?? { label: status, color: 'bg-gray-100 text-gray-500' } : null
  const canEdit = !status || status === 'pendente' || status === 'em_analise' || status === 'rejeitado'

  function submit() {
    setError('')
    if (!arrivalDate) {
      setError('Informe a data prevista de chegada.')
      return
    }
    startTransition(async () => {
      try {
        await solicitarHospedagemObreiro({
          slug, organizationId, ministryId, staffApplicationId, guestName,
          arrivalDate, notes: notes || null,
        })
        setDone(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível registrar a solicitação.')
      }
    })
  }

  return (
    <div className="space-y-3">
      {statusInfo && (
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      )}
      {done && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Solicitação enviada à hospitalidade.</p>}

      {canEdit && (
        <>
          <p className="text-xs text-gray-500">
            Informe quando {guestName} deve chegar — isso cria (ou atualiza) uma pendência para a
            hospitalidade verificar disponibilidade de quarto antes da aprovação final.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data prevista de chegada</label>
              <input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Observações para a hospitalidade</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Ex.: chega de ônibus, precisa de quarto individual…"
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="button" onClick={submit} disabled={isPending}
            className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
            {isPending ? 'Enviando…' : status ? 'Atualizar solicitação' : 'Enviar solicitação à hospitalidade'}
          </button>
        </>
      )}
    </div>
  )
}
