'use client'

import { useState } from 'react'

// Só dígitos — os 2 últimos são sempre os centavos, igual ao teclado
// numérico dos apps de banco (digitar "600" vira 6,00; "60000" vira
// 600,00). Formata ao digitar, sem permitir letras, sinal negativo ou
// o spinner nativo do input number.
function formatFromDigits(digits: string): string {
  if (!digits) return ''
  const padded = digits.padStart(3, '0')
  const centavos = padded.slice(-2)
  const reaisRaw = padded.slice(0, -2).replace(/^0+(?=\d)/, '')
  const reais = reaisRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${reais},${centavos}`
}

function digitsToDecimal(digits: string): string {
  if (!digits) return ''
  return (parseInt(digits, 10) / 100).toFixed(2)
}

type Props = {
  name: string
  label: string
  defaultValue?: number | null
  placeholder?: string
  className?: string
}

export function CurrencyField({ name, label, defaultValue, placeholder, className }: Props) {
  const [digits, setDigits] = useState(
    defaultValue != null ? Math.round(Math.abs(defaultValue) * 100).toString() : ''
  )

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={formatFromDigits(digits)}
          onChange={e => setDigits(e.target.value.replace(/\D/g, '').slice(0, 12))}
          placeholder={placeholder ?? '0,00'}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <input type="hidden" name={name} value={digitsToDecimal(digits)} />
      </div>
    </div>
  )
}
