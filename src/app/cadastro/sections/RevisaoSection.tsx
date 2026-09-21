'use client'

import type { WizardPlan } from './PlanoSection'

export function RevisaoSection({ data, plans, hasSession, sessionEmail }: {
  data: Record<string, string>
  plans: WizardPlan[]
  hasSession: boolean
  sessionEmail?: string | null
}) {
  const plan = plans.find(p => p.id === data.plan_id)

  const rows: Array<[string, string | undefined]> = [
    ['Organização', data.org_name],
    ['Tipo', { jocum: 'JOCUM', missao: 'Outra organização missionária', outro: 'Outro' }[data.org_type] ?? data.org_type],
    ['Cidade/Estado', [data.city, data.state].filter(Boolean).join(', ') || undefined],
    ['Responsável', hasSession ? (sessionEmail ?? undefined) : data.responsavel_nome],
    ['E-mail', hasSession ? (sessionEmail ?? undefined) : data.responsavel_email],
    ['Plano', plan?.name],
  ]

  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-gray-900">Revisão</h2>
      <p className="text-xs text-gray-500 -mt-3">Confira os dados antes de criar sua organização.</p>

      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {rows.filter(([, v]) => v).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-900 text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
