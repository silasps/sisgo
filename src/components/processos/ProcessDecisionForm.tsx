'use client'

import { FinancePendingConfirmButton } from '@/components/finance/FinancePendingConfirmButton'
import type { PersonFinanceSummary } from '@/lib/finance/personFinanceStatus'
import { MoveTypeFields, type MoveTypeValue } from './MoveTypeFields'

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300'

// OK final do DH em /processos: o card de configuração já vem com o que foi
// pedido (tipo, função, período) e o DH ajusta antes de efetivar. Encerrar não
// valida esses campos (formNoValidate) — o servidor ignora a configuração ao
// encerrar. Campos: kind, process_id, move_type, role_id|role, starts_on,
// ends_on, notes, decision.
export function ProcessDecisionForm(p: {
  action: (formData: FormData) => Promise<void>
  kind: 'emprestimo' | 'transferencia'
  processId: string
  personName: string
  fromName: string
  toName: string
  toUnitType: 'school' | 'ministry'
  defaultMoveType: MoveTypeValue
  /** Funções do ministério de destino. */
  roleOptions: Array<{ id: string; name: string }>
  defaultRoleId: string | null
  /** Destino escola: papel em texto livre. */
  defaultRoleText: string | null
  /** Período só existe no pedido de obreiro (staff_loans). */
  showPeriod: boolean
  defaultStartsOn: string | null
  defaultEndsOn: string | null
  todayStr: string
  financeSummary: PersonFinanceSummary
  rejectLabel: string
}) {
  const firstName = p.personName.split(' ')[0]
  return (
    <form action={p.action} className="space-y-3 border-t border-purple-100 pt-3">
      <input type="hidden" name="kind" value={p.kind} />
      <input type="hidden" name="process_id" value={p.processId} />

      <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-3 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-800">Como {firstName} vai servir</p>
        <MoveTypeFields
          defaultMoveType={p.defaultMoveType}
          fromName={p.fromName}
          toName={p.toName}
          todayStr={p.todayStr}
          defaultStartsOn={p.defaultStartsOn}
          defaultEndsOn={p.defaultEndsOn}
          inputClassName={INPUT}
          showPeriod={p.showPeriod}
        />
        <div>
          <label className="block text-[11px] text-purple-800 mb-1">Função em {p.toName}</label>
          {p.toUnitType === 'ministry' ? (
            <select name="role_id" defaultValue={p.defaultRoleId ?? ''} className={INPUT}>
              <option value="">Sem papel específico</option>
              {p.roleOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          ) : (
            <input name="role" defaultValue={p.defaultRoleText ?? 'Obreiro'} placeholder="Ex.: Obreiro, Monitor, Instrutor" className={INPUT} />
          )}
        </div>
      </div>

      <input name="notes" placeholder="Observação do DH (opcional)" className={INPUT} />
      <div className="flex gap-2">
        <FinancePendingConfirmButton
          action={p.action}
          financeSummary={p.financeSummary}
          personName={p.personName}
          extraFields={{ decision: 'efetivar' }}
          className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Dar OK final
        </FinancePendingConfirmButton>
        <button
          type="submit"
          name="decision"
          value="encerrar"
          formNoValidate
          className="flex-1 px-3 py-2 border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors"
        >
          {p.rejectLabel}
        </button>
      </div>
    </form>
  )
}
