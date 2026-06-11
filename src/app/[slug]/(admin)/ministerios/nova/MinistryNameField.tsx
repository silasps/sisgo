'use client'

import { useState } from 'react'

const MINISTRY_OPTIONS = [
  'DH',
  'Secretaria / Administrativo',
  'Financeiro',
  'Hospitalidade',
  'Cozinha',
  'Comunicação',
  'Louvor',
  'Intercessão',
  'Manutenção',
]

export function MinistryNameField() {
  const [selected, setSelected] = useState(MINISTRY_OPTIONS[0])
  const [customName, setCustomName] = useState('')
  const isOther = selected === 'Outro'
  const resolvedName = isOther ? customName.trim() : selected

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Nome <span className="text-red-500">*</span>
      </label>
      <select
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        {MINISTRY_OPTIONS.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
        <option value="Outro">Outro</option>
      </select>
      {isOther && (
        <input
          value={customName}
          onChange={(event) => setCustomName(event.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          placeholder="Digite o nome do ministério"
        />
      )}
      <input type="hidden" name="name" value={resolvedName} />
    </div>
  )
}
