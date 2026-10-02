'use client'

import { useMemo, useState } from 'react'

// Lista curada (não exaustiva) — cobre Brasil, campo missionário mais comum
// e os países ocidentais mais frequentes. Fácil de estender: só acrescentar
// no array.
export const PHONE_COUNTRIES = [
  { iso: 'BR', name: 'Brasil', dial: '55', flag: '🇧🇷' },
  { iso: 'US', name: 'Estados Unidos', dial: '1', flag: '🇺🇸' },
  { iso: 'CA', name: 'Canadá', dial: '1', flag: '🇨🇦' },
  { iso: 'PT', name: 'Portugal', dial: '351', flag: '🇵🇹' },
  { iso: 'AR', name: 'Argentina', dial: '54', flag: '🇦🇷' },
  { iso: 'CL', name: 'Chile', dial: '56', flag: '🇨🇱' },
  { iso: 'CO', name: 'Colômbia', dial: '57', flag: '🇨🇴' },
  { iso: 'PY', name: 'Paraguai', dial: '595', flag: '🇵🇾' },
  { iso: 'UY', name: 'Uruguai', dial: '598', flag: '🇺🇾' },
  { iso: 'BO', name: 'Bolívia', dial: '591', flag: '🇧🇴' },
  { iso: 'PE', name: 'Peru', dial: '51', flag: '🇵🇪' },
  { iso: 'EC', name: 'Equador', dial: '593', flag: '🇪🇨' },
  { iso: 'VE', name: 'Venezuela', dial: '58', flag: '🇻🇪' },
  { iso: 'MX', name: 'México', dial: '52', flag: '🇲🇽' },
  { iso: 'ES', name: 'Espanha', dial: '34', flag: '🇪🇸' },
  { iso: 'GB', name: 'Reino Unido', dial: '44', flag: '🇬🇧' },
  { iso: 'DE', name: 'Alemanha', dial: '49', flag: '🇩🇪' },
  { iso: 'FR', name: 'França', dial: '33', flag: '🇫🇷' },
  { iso: 'IT', name: 'Itália', dial: '39', flag: '🇮🇹' },
  { iso: 'NL', name: 'Países Baixos', dial: '31', flag: '🇳🇱' },
  { iso: 'CH', name: 'Suíça', dial: '41', flag: '🇨🇭' },
  { iso: 'AU', name: 'Austrália', dial: '61', flag: '🇦🇺' },
  { iso: 'NZ', name: 'Nova Zelândia', dial: '64', flag: '🇳🇿' },
  { iso: 'JP', name: 'Japão', dial: '81', flag: '🇯🇵' },
  { iso: 'KR', name: 'Coreia do Sul', dial: '82', flag: '🇰🇷' },
  { iso: 'CN', name: 'China', dial: '86', flag: '🇨🇳' },
  { iso: 'IN', name: 'Índia', dial: '91', flag: '🇮🇳' },
  { iso: 'ZA', name: 'África do Sul', dial: '27', flag: '🇿🇦' },
  { iso: 'MZ', name: 'Moçambique', dial: '258', flag: '🇲🇿' },
  { iso: 'AO', name: 'Angola', dial: '244', flag: '🇦🇴' },
  { iso: 'NG', name: 'Nigéria', dial: '234', flag: '🇳🇬' },
  { iso: 'KE', name: 'Quênia', dial: '254', flag: '🇰🇪' },
  { iso: 'IL', name: 'Israel', dial: '972', flag: '🇮🇱' },
  { iso: 'PH', name: 'Filipinas', dial: '63', flag: '🇵🇭' },
  { iso: 'TH', name: 'Tailândia', dial: '66', flag: '🇹🇭' },
  { iso: 'IE', name: 'Irlanda', dial: '353', flag: '🇮🇪' },
  { iso: 'SE', name: 'Suécia', dial: '46', flag: '🇸🇪' },
  { iso: 'NO', name: 'Noruega', dial: '47', flag: '🇳🇴' },
]

// Formato salvo/emitido: "+<ddi> <número só dígitos>" (ex. "+55 18997255572")
// — o "+ddi" na frente é o que permite extrair o país depois em relatório
// (basta pegar até o primeiro espaço), sem precisar de coluna nova no banco.
function parsePhoneValue(value: string) {
  const m = value.trim().match(/^\+(\d{1,4})\s*(.*)$/)
  if (m) {
    const country = PHONE_COUNTRIES.find(c => c.dial === m[1]) ?? PHONE_COUNTRIES.find(c => m[1].startsWith(c.dial))
    return { dial: country?.dial ?? m[1], digits: m[2].replace(/\D/g, '') }
  }
  return { dial: '55', digits: value.replace(/\D/g, '') }
}

function formatDigits(digits: string, dial: string) {
  if (dial !== '55') return digits
  const d = digits.slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function PhoneInput({
  value, onChange, placeholder, autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const parsed = useMemo(() => parsePhoneValue(value), [value])
  const [dial, setDial] = useState(parsed.dial)
  // Dígitos ficam em estado próprio (não recalculados do `value` a cada
  // tecla) — assim o cursor não pula quando a máscara reformata o texto.
  const [digits, setDigits] = useState(parsed.digits)

  function emit(nextDial: string, nextDigits: string) {
    onChange(nextDigits ? `+${nextDial} ${nextDigits}` : '')
  }

  return (
    <div className="flex gap-1.5">
      <select
        value={dial}
        onChange={e => { setDial(e.target.value); emit(e.target.value, digits) }}
        className="w-[92px] shrink-0 rounded-lg border border-gray-200 px-1.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        {PHONE_COUNTRIES.map(c => (
          <option key={c.iso} value={c.dial}>{c.flag} +{c.dial}</option>
        ))}
      </select>
      <input
        type="tel"
        autoFocus={autoFocus}
        value={formatDigits(digits, dial)}
        onChange={e => {
          const raw = e.target.value.replace(/\D/g, '').slice(0, 13)
          setDigits(raw)
          emit(dial, raw)
        }}
        placeholder={placeholder ?? (dial === '55' ? '(41) 99999-9999' : 'Número')}
        className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  )
}
