'use client'

import { useState } from 'react'

export type MoveTypeValue = 'acumulo' | 'transferencia'

// Escolha de como a pessoa vai servir quando já está em outra escola/ministério
// — no pedido (líder/DH) e no OK final do DH em Processos (migration 164).
// Período só existe no acúmulo: transferência não tem fim, e sem data final o
// acúmulo fica sem prazo. Campos: move_type, starts_on, ends_on.
export function MoveTypeFields({
  defaultMoveType = 'acumulo', fromName, toName, todayStr, defaultStartsOn, defaultEndsOn, inputClassName, showPeriod = true,
}: {
  defaultMoveType?: MoveTypeValue
  /** Onde a pessoa já serve (sem nome: "onde já serve"). */
  fromName?: string | null
  /** Destino (sem nome: "aqui"). */
  toName?: string | null
  todayStr: string
  defaultStartsOn?: string | null
  defaultEndsOn?: string | null
  inputClassName: string
  showPeriod?: boolean
}) {
  const [moveType, setMoveType] = useState<MoveTypeValue>(defaultMoveType)
  const [startsOn, setStartsOn] = useState(defaultStartsOn || todayStr)
  const from = fromName ?? 'onde já serve'
  const dest = toName ? `em ${toName}` : 'aqui'

  const options: Array<{ value: MoveTypeValue; title: string; desc: string }> = [
    { value: 'acumulo', title: 'Acúmulo de funções', desc: `Continua em ${from} e passa a servir também ${dest}.` },
    { value: 'transferencia', title: 'Transferência', desc: `Sai de ${from} e passa a servir só ${dest}.` },
  ]

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
        {options.map(o => {
          const checked = moveType === o.value
          return (
            <label
              key={o.value}
              className={`block cursor-pointer rounded-lg border bg-white p-3 transition-colors focus-within:ring-2 focus-within:ring-purple-300 ${checked ? 'border-purple-500 ring-1 ring-purple-500' : 'border-purple-100 hover:border-purple-300'}`}
            >
              <input
                type="radio"
                name="move_type"
                value={o.value}
                checked={checked}
                onChange={() => setMoveType(o.value)}
                className="sr-only"
              />
              <span className="flex items-center gap-2 text-sm font-semibold text-purple-950">
                <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${checked ? 'border-purple-600' : 'border-purple-200'}`}>
                  {checked && <span className="size-2 rounded-full bg-purple-600" />}
                </span>
                {o.title}
              </span>
              <span className="mt-0.5 block pl-6 text-xs text-gray-500">{o.desc}</span>
            </label>
          )
        })}
      </div>
      {showPeriod && moveType === 'acumulo' && (
        <div className="space-y-1">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] text-purple-800 mb-1">A partir de</label>
              <input type="date" name="starts_on" value={startsOn} onChange={e => setStartsOn(e.target.value)} required className={inputClassName} />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] text-purple-800 mb-1">Até (opcional)</label>
              <input type="date" name="ends_on" defaultValue={defaultEndsOn ?? ''} min={startsOn} className={inputClassName} />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Sem data final, o acúmulo fica sem prazo.</p>
        </div>
      )}
    </div>
  )
}
