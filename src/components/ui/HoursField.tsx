'use client'

import { useState } from 'react'

// Carga horária é o dado que certificados e o alerta de "cadastro
// incompleto" (aba Geral da escola) precisam como número — mas ninguém
// pensa em "480 horas", pensa em "20 semanas, 6h por semana". Em vez de
// obrigar a pessoa a multiplicar de cabeça antes de digitar, o campo real
// (enviado no form) fica junto de uma calculadora que faz a conta e só
// preenche com um clique — sem travar quem já sabe o total de cabeça.
export function HoursField({ name, defaultValue }: { name: string; defaultValue: number | null }) {
  const [value, setValue] = useState(defaultValue != null ? String(defaultValue) : '')
  const [weeks, setWeeks] = useState('')
  const [hoursPerWeek, setHoursPerWeek] = useState('')
  const computed = Number(weeks) > 0 && Number(hoursPerWeek) > 0 ? Number(weeks) * Number(hoursPerWeek) : null
  const INPUT_SM = 'w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400'

  return (
    <div>
      <input
        type="number" name={name} min={0} step={1} value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Ex: 480"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
        <span>Não sabe de cabeça? Calcule:</span>
        <input type="number" min={0} step={1} value={weeks} onChange={e => setWeeks(e.target.value)} placeholder="semanas" className={INPUT_SM} />
        <span>×</span>
        <input type="number" min={0} step={1} value={hoursPerWeek} onChange={e => setHoursPerWeek(e.target.value)} placeholder="h/semana" className={INPUT_SM} />
        {computed != null && (
          <button type="button" onClick={() => setValue(String(computed))} className="font-semibold text-brand-600 hover:text-brand-700 hover:underline">
            = {computed}h → usar
          </button>
        )}
      </div>
    </div>
  )
}
