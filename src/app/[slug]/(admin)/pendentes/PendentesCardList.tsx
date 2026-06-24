'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Mail, MessageCircle, Calendar, ArrowRight } from 'lucide-react'

export type PendenteModalItem = {
  id: string
  categoria: string
  nome: string
  escola: string | null
  status: string
  statusLabel: string
  statusColor: string
  criadoEm: string
  diasAberto: number
  linkDestino: string
  overflow: boolean
  overflowEscola?: string
  email?: string | null
  phone?: string | null
  turma?: string | null
  mensagem?: string | null
  ministryName?: string | null
}

function urgencyBadge(dias: number) {
  if (dias <= 1) return { label: dias === 0 ? 'Hoje' : '1d', color: 'bg-green-100 text-green-700' }
  if (dias === 2) return { label: '2d', color: 'bg-yellow-100 text-yellow-700' }
  if (dias === 3) return { label: '3d', color: 'bg-orange-100 text-orange-700' }
  return { label: `${dias}d`, color: 'bg-red-100 text-red-700' }
}

function whatsappLink(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '')
  let formatted: string | null = null
  if (digits.length === 10 || digits.length === 11) formatted = `55${digits}`
  else if (digits.length >= 12 && digits.length <= 15) formatted = digits
  if (!formatted) return null
  return `https://wa.me/${formatted}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Props = {
  items: PendenteModalItem[]
}

export function PendentesCardList({ items }: Props) {
  const [selected, setSelected] = useState<PendenteModalItem | null>(null)
  const router = useRouter()

  const close = useCallback(() => setSelected(null), [])

  useEffect(() => {
    if (!selected) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selected, close])

  function handleResolve(item: PendenteModalItem) {
    close()
    const url = new URL(item.linkDestino, window.location.origin)
    url.searchParams.set('highlight', item.id)
    router.push(url.pathname + url.search)
  }

  return (
    <>
      <div className="space-y-2">
        {items.map(item => {
          const urgency = urgencyBadge(item.diasAberto)
          return (
            <button
              key={`${item.categoria}-${item.id}`}
              type="button"
              onClick={() => setSelected(item)}
              className={`group w-full text-left flex items-center gap-3 bg-white rounded-xl border px-4 py-3.5 shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${item.overflow ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200'}`}
            >
              <span className={`flex-shrink-0 inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${urgency.color}`}>
                {urgency.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 truncate transition-colors">
                  {item.nome}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  <span className="text-xs text-gray-400">{item.categoria}</span>
                  {item.escola && (
                    <>
                      <span className="text-gray-300 text-xs">·</span>
                      <span className="text-xs text-gray-400 truncate">{item.escola}</span>
                    </>
                  )}
                  {item.overflow && (
                    <span className="text-xs text-orange-600 font-medium">
                      · Sem resposta há {item.diasAberto}d
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${item.statusColor}`}>
                  {item.statusLabel}
                </span>
                <span className="text-xs font-semibold text-brand-500 group-hover:text-brand-700 transition-colors">
                  Abrir →
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Modal de detalhes */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={close}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-[fade-slide-up_0.25s_ease]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide">
                  {selected.categoria}
                </p>
                <h2 className="text-base font-bold text-gray-900 mt-0.5">{selected.nome}</h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${selected.statusColor}`}>
                  {selected.statusLabel}
                </span>
                {(() => {
                  const u = urgencyBadge(selected.diasAberto)
                  return (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.color}`}>
                      {selected.diasAberto === 0 ? 'Aberto hoje' : `Há ${selected.diasAberto} dia${selected.diasAberto > 1 ? 's' : ''}`}
                    </span>
                  )
                })()}
              </div>

              {/* Detalhes */}
              <div className="space-y-3">
                {selected.escola && (
                  <DetailRow label="Escola" value={selected.escola} />
                )}
                {selected.turma && (
                  <DetailRow label="Turma" value={selected.turma} />
                )}
                {selected.ministryName && (
                  <DetailRow label="Ministério" value={selected.ministryName} />
                )}
                <DetailRow label="Data" value={formatDate(selected.criadoEm)} />
              </div>

              {/* Contato */}
              {(selected.email || selected.phone) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selected.email && (
                    <a
                      href={`mailto:${selected.email}`}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Mail size={14} /> {selected.email}
                    </a>
                  )}
                  {whatsappLink(selected.phone) && (
                    <a
                      href={whatsappLink(selected.phone)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-2 border border-green-200 text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  )}
                </div>
              )}

              {/* Mensagem / notas */}
              {selected.mensagem && (
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Mensagem</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{selected.mensagem}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => handleResolve(selected)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Resolver pendência <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-medium text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  )
}
