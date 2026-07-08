'use client'

import { useState, useTransition } from 'react'
import { updateBackgroundCheck, addBackgroundCheck } from './actions'
import { daysUntil, expiryUrgency, expiryLabel, EXPIRY_URGENCY_STYLE } from '@/lib/background-checks/expiry'

export type BackgroundCheck = {
  id: string
  check_type: string
  country: string | null
  status: string
  issued_at: string | null
  expires_at: string | null
  notes: string | null
  flagged_concern: boolean
}

const CHECK_TYPE_LABELS: Record<string, string> = {
  pf_federal: 'Certidão de Antecedentes Criminais — Polícia Federal (BR)',
  ssp_estadual: 'Certidão Estadual — SSP/Polícia Civil (BR)',
  police_clearance_estrangeiro: 'Police Clearance — país de cidadania/residência (estrangeiro)',
  autodeclaracao_conduta: 'Autodeclaração de conduta',
  referencia_conduta_menores: 'Checagem de referência — conduta com menores',
  outro: 'Outro',
}

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'solicitado', label: 'Solicitado' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'reprovado', label: 'Reprovado' },
  { value: 'nao_aplicavel', label: 'Não aplicável' },
]

const STATUS_COLORS: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-700',
  solicitado: 'bg-blue-100 text-blue-700',
  em_analise: 'bg-yellow-100 text-yellow-700',
  aprovado: 'bg-green-100 text-green-700',
  reprovado: 'bg-red-100 text-red-700',
  nao_aplicavel: 'bg-gray-100 text-gray-500',
}

type Props = {
  checks: BackgroundCheck[]
  organizationId: string
  slug: string
  staffApplicationId: string
  personId: string | null
  readOnly: boolean
}

function CheckRow({ check, organizationId, slug, staffApplicationId, readOnly }: {
  check: BackgroundCheck
  organizationId: string
  slug: string
  staffApplicationId: string
  readOnly: boolean
}) {
  const [status, setStatus] = useState(check.status)
  const [notes, setNotes] = useState(check.notes ?? '')
  const [issuedAt, setIssuedAt] = useState(check.issued_at ?? '')
  const [expiresAt, setExpiresAt] = useState(check.expires_at ?? '')
  const [flagged, setFlagged] = useState(check.flagged_concern)
  const [isPending, startTransition] = useTransition()

  const daysLeft = expiresAt ? daysUntil(expiresAt) : null
  const urgency = daysLeft !== null ? expiryUrgency(daysLeft) : null

  function save() {
    startTransition(() => {
      updateBackgroundCheck({
        id: check.id,
        organizationId,
        slug,
        staffApplicationId,
        status,
        notes,
        issuedAt,
        expiresAt,
        flaggedConcern: flagged,
      })
    })
  }

  return (
    <div className={`py-3 border-b border-gray-50 last:border-0 ${flagged ? 'border-l-2 border-l-red-400 pl-3 -ml-3' : ''}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <p className="text-sm font-medium text-gray-800">
          {CHECK_TYPE_LABELS[check.check_type] ?? check.check_type}
          {check.country && <span className="text-gray-400 font-normal"> — {check.country}</span>}
        </p>
        <div className="flex items-center gap-2">
          {urgency && urgency !== 'ok' && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${EXPIRY_URGENCY_STYLE[urgency]}`}>
              {expiryLabel(daysLeft as number, urgency)}
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}>
            {STATUS_OPTIONS.find(o => o.value === status)?.label ?? status}
          </span>
        </div>
      </div>

      {readOnly ? (
        notes && <p className="text-xs text-gray-500 whitespace-pre-wrap">{notes}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="col-span-2 sm:col-span-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)}
            title="Data de emissão"
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
          />
          <input
            type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
            title="Data de validade"
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
          />
          <label className="flex items-center gap-1.5 text-xs text-red-700 whitespace-nowrap">
            <input type="checkbox" checked={flagged} onChange={e => setFlagged(e.target.checked)} />
            Preocupante
          </label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Observação do DH"
            rows={2}
            className="col-span-2 sm:col-span-3 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
          />
          <button
            type="button" onClick={save} disabled={isPending}
            className="rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5 hover:bg-gray-800 disabled:opacity-50"
          >
            {isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function BackgroundChecksSection({ checks, organizationId, slug, staffApplicationId, personId, readOnly }: Props) {
  const [items, setItems] = useState(checks)
  const [adding, setAdding] = useState(false)
  const [newCountry, setNewCountry] = useState('')
  const [isPending, startTransition] = useTransition()

  function addOutro() {
    startTransition(async () => {
      await addBackgroundCheck({
        organizationId, slug, staffApplicationId, personId,
        checkType: 'outro',
        country: newCountry,
      })
      setItems(prev => [...prev, {
        id: `temp-${Date.now()}`, check_type: 'outro', country: newCountry || null,
        status: 'pendente', issued_at: null, expires_at: null, notes: null, flagged_concern: false,
      }])
      setAdding(false)
      setNewCountry('')
    })
  }

  return (
    <div>
      {items.length === 0 && (
        <p className="text-xs text-gray-400 py-2">Nenhuma verificação registrada ainda.</p>
      )}
      {items.map(check => (
        <CheckRow
          key={check.id}
          check={check}
          organizationId={organizationId}
          slug={slug}
          staffApplicationId={staffApplicationId}
          readOnly={readOnly}
        />
      ))}
      {!readOnly && (
        <div className="pt-3">
          {adding ? (
            <div className="flex items-center gap-2">
              <input
                value={newCountry} onChange={e => setNewCountry(e.target.value)}
                placeholder="Observação (ex.: certidão de justiça estadual/federal)"
                className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
              />
              <button type="button" onClick={addOutro} disabled={isPending} className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
                Adicionar
              </button>
              <button type="button" onClick={() => setAdding(false)} className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="text-xs text-gray-500 hover:text-gray-700 underline">
              + Adicionar outra verificação
            </button>
          )}
        </div>
      )}
    </div>
  )
}
