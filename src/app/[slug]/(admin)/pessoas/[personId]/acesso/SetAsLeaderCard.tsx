'use client'

import { useState } from 'react'

type OptionRow = { id: string; name: string }
export type Leadership = { type: 'school' | 'ministry'; id: string; name: string }

export function SetAsLeaderCard({
  action, removeAction, schools, ministries, currentLeaderships,
}: {
  action: (formData: FormData) => void
  removeAction: (formData: FormData) => void
  schools: OptionRow[]
  ministries: OptionRow[]
  currentLeaderships: Leadership[]
}) {
  const [unitType, setUnitType] = useState<'school' | 'ministry'>('school')
  const options = unitType === 'school' ? schools : ministries
  const INPUT = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Definir como líder</h2>
      <p className="text-xs text-gray-400 mb-3">
        Torna esta pessoa líder (ou colíder, se já houver um) de uma escola ou ministério da base.
        Quem ainda não tem login ganha um automaticamente.
      </p>

      {currentLeaderships.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Já lidera:</p>
          <ul className="space-y-1.5">
            {currentLeaderships.map(l => (
              <li key={`${l.type}-${l.id}`} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                <span className="text-sm text-gray-700 min-w-0 truncate">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mr-1.5">
                    {l.type === 'school' ? 'Escola' : 'Ministério'}
                  </span>
                  {l.name}
                </span>
                <form action={removeAction} className="shrink-0">
                  <input type="hidden" name="unit_type" value={l.type} />
                  <input type="hidden" name="unit_id" value={l.id} />
                  <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                    Remover
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={action} className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={unitType}
            onChange={e => setUnitType(e.target.value as 'school' | 'ministry')}
            className={INPUT}
          >
            <option value="school">Escola</option>
            <option value="ministry">Ministério</option>
          </select>
          <input type="hidden" name="unit_type" value={unitType} />
          <select key={unitType} name="unit_id" required defaultValue="" className={`${INPUT} flex-1`}>
            <option value="" disabled>Selecionar {unitType === 'school' ? 'escola' : 'ministério'}...</option>
            {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <button type="submit" className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
          Definir como líder
        </button>
      </form>
    </div>
  )
}
