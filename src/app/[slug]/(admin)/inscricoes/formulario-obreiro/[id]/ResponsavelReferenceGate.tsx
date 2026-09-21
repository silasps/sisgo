'use client'

import { useState, useTransition } from 'react'
import { resolverAutorizacaoResponsavelManualmente } from './actions'

type Props = {
  staffApplicationId: string
  organizationId: string
  slug: string
  status: 'enviado' | 'pendente'
  readOnly: boolean
}

export function ResponsavelReferenceGate({ staffApplicationId, organizationId, slug, status, readOnly }: Props) {
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [isPending, startTransition] = useTransition()
  const [resolved, setResolved] = useState(status === 'enviado')

  if (resolved || readOnly) return null

  return (
    <div className="mt-2">
      {open ? (
        <div className="space-y-2">
          <input
            value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Nome do responsável com quem foi confirmado"
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
          />
          <textarea
            value={observacoes} onChange={e => setObservacoes(e.target.value)}
            placeholder="Observação (opcional) — ex.: autorizado por telefone em 10/09"
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
          />
          <div className="flex gap-2">
            <button
              type="button" disabled={isPending || !nome.trim()}
              onClick={() => startTransition(async () => {
                await resolverAutorizacaoResponsavelManualmente({ staffApplicationId, organizationId, slug, nomeResponsavel: nome, observacoes })
                setResolved(true)
                setOpen(false)
              })}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? 'Salvando…' : 'Confirmar resolução manual'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-xs text-amber-700 hover:text-amber-900 underline">
          Resolver manualmente (falei com o responsável)
        </button>
      )}
    </div>
  )
}
