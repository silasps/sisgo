'use client'

import { useState } from 'react'
import { GerarLinkRefBtn } from './GerarLinkRefBtn'

type Props = {
  tipo: 'pastor' | 'amigo'
  data: Record<string, string> | null
  status: 'pendente' | 'enviado'
  slug: string
  applicationId: string
}

function FieldItem({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null
  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  )
}

const RECOMENDAM: Record<string, string> = {
  sim: 'Recomendo plenamente',
  sim_ressalvas: 'Recomendo com ressalvas',
  nao: 'Não recomendo',
}
const RECOMENDAM_COR: Record<string, string> = {
  sim: 'bg-green-100 text-green-700',
  sim_ressalvas: 'bg-yellow-100 text-yellow-700',
  nao: 'bg-red-100 text-red-700',
}
const APOIA: Record<string, string> = {
  sim: 'Apoia e autoriza',
  nao: 'Não apoia',
}
const APOIA_COR: Record<string, string> = {
  sim: 'bg-green-100 text-green-700',
  nao: 'bg-red-100 text-red-700',
}

export function ReferenceModal({ tipo, data, status, slug, applicationId }: Props) {
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm"
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
              ) : data && tipo === 'pastor' ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {data.recomenda && (
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${RECOMENDAM_COR[data.recomenda] ?? 'bg-gray-100 text-gray-600'}`}>
                        {RECOMENDAM[data.recomenda] ?? data.recomenda}
                      </span>
                    )}
                    {data.apoia && (
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${APOIA_COR[data.apoia] ?? 'bg-gray-100 text-gray-600'}`}>
                        {APOIA[data.apoia] ?? data.apoia}
                      </span>
                    )}
                  </div>
                  <FieldItem label="Nome" value={data.pastor_nome} />
                  <FieldItem label="Cargo / Igreja" value={[data.pastor_cargo, data.pastor_igreja, data.pastor_cidade].filter(Boolean).join(' · ')} />
                  <FieldItem label="Tempo que conhece o(a) candidato(a)" value={data.tempo_conhece} />
                  <FieldItem label="E-mail" value={data.pastor_email} />
                  <FieldItem label="Telefone" value={data.pastor_telefone} />
                  <FieldItem label="Caráter e maturidade espiritual" value={data.carater} />
                  <FieldItem label="Responsabilidade e comprometimento" value={data.responsabilidade} />
                  <FieldItem label="Relacionamento com autoridade" value={data.autoridade} />
                  <FieldItem label="Dificuldades conhecidas" value={data.dificuldades} />
                  <FieldItem label="Ressalvas / Observações" value={data.observacoes} />
                </>
              ) : data ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {data.recomenda && (
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${RECOMENDAM_COR[data.recomenda] ?? 'bg-gray-100 text-gray-600'}`}>
                        {RECOMENDAM[data.recomenda] ?? data.recomenda}
                      </span>
                    )}
                  </div>
                  <FieldItem label="Nome" value={data.ref_nome} />
                  <FieldItem label="Como se conheceram" value={data.como_conheceu} />
                  <FieldItem label="Tempo de amizade" value={data.tempo_conhece} />
                  <FieldItem label="É cristã?" value={data.crista === 'sim' ? 'Sim' : data.crista === 'nao' ? 'Não' : data.crista} />
                  <FieldItem label="E-mail" value={data.ref_email} />
                  <FieldItem label="Telefone" value={data.ref_telefone} />
                  <FieldItem label="Caráter e personalidade" value={data.carater} />
                  <FieldItem label="Pontos fortes" value={data.pontos_fortes} />
                  <FieldItem label="Áreas de crescimento" value={data.areas_crescimento} />
                  <FieldItem label="Sob pressão / conflito" value={data.sob_pressao} />
                  <FieldItem label="Relacionamentos" value={data.relacionamentos} />
                  <FieldItem label="Observações" value={data.observacoes} />
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
