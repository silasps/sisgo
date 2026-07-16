'use client'

import { useState } from 'react'
import { GerarLinkRefBtn } from './GerarLinkRefBtn'
import { ReferenceAnswers } from '../../ReferenceAnswers'

type Props = {
  tipo: 'pastor' | 'amigo'
  data: Record<string, string> | null
  status: 'pendente' | 'enviado'
  slug: string
  applicationId: string
  isStaff?: boolean
}

export function ReferenceModal({ tipo, data, status, slug, applicationId, isStaff }: Props) {
  const [open, setOpen] = useState(false)
  const tipoLabel = tipo === 'pastor' ? 'Pastor / Líder' : 'Amigo / Referência'
  const isPending = status === 'pendente' || !data

  const btnBase = 'w-full py-3 px-4 border rounded-xl text-sm font-semibold transition-colors flex items-center justify-between gap-2'
  const btnStyle = isPending
    ? `${btnBase} bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100`
    : `${btnBase} bg-green-50 border-green-200 text-green-700 hover:bg-green-100`

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnStyle}>
        <span>{isPending ? `Aguardando — ${tipoLabel}` : `Ver formulário — ${tipoLabel}`}</span>
        <span className="shrink-0">{isPending ? '⏳' : '✓'}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 md:left-60 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">{tipoLabel}</p>
                {!isPending && data && (
                  <p className="font-semibold text-gray-900 mt-0.5 text-sm">
                    {tipo === 'pastor'
                      ? [data.pastor_nome, data.pastor_cargo, data.pastor_igreja].filter(Boolean).join(' · ')
                      : [data.ref_nome, data.como_conheceu].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-2xl text-gray-400 hover:text-gray-700 leading-none w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-5 space-y-1">
              {isPending ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-2xl">⏳</p>
                  <p className="font-semibold text-amber-700">Formulário ainda não preenchido</p>
                  <p className="text-sm text-gray-500">Gere o link abaixo e envie para esta pessoa.</p>
                  <GerarLinkRefBtn slug={slug} applicationId={applicationId} tipo={tipo} />
                </div>
              ) : data ? (
                <ReferenceAnswers tipo={tipo} data={data} isStaff={isStaff} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
