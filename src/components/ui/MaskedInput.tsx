'use client'

import { useState } from 'react'

type MaskType = 'cpf' | 'cep' | 'rg'

function applyMask(raw: string, mask: MaskType): string {
  const d = raw.replace(/\D/g, '')
  if (mask === 'cpf') {
    // 000.000.000-00
    return d.slice(0, 11)
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3}\.\d{3}\.\d{3})(\d{1,2})$/, '$1-$2')
  }
  if (mask === 'cep') {
    // 00000-000
    return d.slice(0, 8)
      .replace(/^(\d{5})(\d{1,3})$/, '$1-$2')
  }
  if (mask === 'rg') {
    // 00.000.000-0 (Brasileiro padrão — dígito verificador pode ser X)
    const withX = raw.replace(/[^0-9xX]/g, '').toUpperCase()
    const body = withX.slice(0, 9)
    return body
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{2}\.\d{3}\.\d{3})([0-9X])$/, '$1-$2')
  }
  return raw
}

const MAX_LEN: Record<MaskType, number> = { cpf: 14, cep: 9, rg: 12 }
const PLACEHOLDER: Record<MaskType, string> = {
  cpf: '000.000.000-00',
  cep: '00000-000',
  rg:  '00.000.000-0',
}

type Props = {
  mask: MaskType
  name: string
  label: string
  defaultValue?: string
  required?: boolean
  className?: string
  inputClassName?: string
}

export function MaskedInput({ mask, name, label, defaultValue, required, inputClassName }: Props) {
  const [value, setValue] = useState(defaultValue ? applyMask(defaultValue, mask) : '')

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        name={name}
        value={value}
        onChange={e => setValue(applyMask(e.target.value, mask))}
        placeholder={PLACEHOLDER[mask]}
        maxLength={MAX_LEN[mask]}
        required={required}
        inputMode={mask === 'rg' ? 'text' : 'numeric'}
        className={inputClassName ?? 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50'}
      />
    </div>
  )
}

/** Versão para o formulário de pré-inscrição público (estilos maiores) */
export function MaskedInputPublic({ mask, name, label, defaultValue, required }: Props) {
  const [value, setValue] = useState(defaultValue ? applyMask(defaultValue, mask) : '')

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}{required && <span className="text-red-500 ml-0.5"> *</span>}
      </label>
      <input
        name={name}
        value={value}
        onChange={e => setValue(applyMask(e.target.value, mask))}
        placeholder={PLACEHOLDER[mask]}
        maxLength={MAX_LEN[mask]}
        required={required}
        inputMode={mask === 'rg' ? 'text' : 'numeric'}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 placeholder-gray-400"
      />
    </div>
  )
}

/** Hook para usar em campos controlados já existentes (ex: CepAddressFields) */
export function useMask(mask: MaskType, initial = '') {
  const [value, setValue] = useState(initial ? applyMask(initial, mask) : '')
  const onChange = (raw: string) => setValue(applyMask(raw, mask))
  return { value, onChange }
}
