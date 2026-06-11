'use client'

import { useMemo, useState } from 'react'
import { PHONE_COUNTRIES } from '@/lib/i18n/phoneCountries'

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function findCountryByIso(iso: string | null | undefined) {
  return PHONE_COUNTRIES.find(country => country.iso === iso) ?? PHONE_COUNTRIES[0]
}

function findCountryByPhone(phone: string | null | undefined) {
  const value = phone ?? ''
  return PHONE_COUNTRIES
    .filter(country => value.replace(/\s/g, '').startsWith(country.code))
    .sort((a, b) => b.code.length - a.code.length)[0]
}

function formatLocalPhone(iso: string, rawValue: string) {
  const country = findCountryByIso(iso)
  const dialDigits = digitsOnly(country.code)
  const rawDigits = digitsOnly(rawValue)
  const digits = rawDigits.startsWith(dialDigits) && rawDigits.length > 10
    ? rawDigits.slice(dialDigits.length)
    : rawDigits

  if (iso === 'BR') {
    const local = digits.slice(0, 11)
    if (local.length <= 2) return local ? `(${local}` : ''
    if (local.length <= 6) return `(${local.slice(0, 2)}) ${local.slice(2)}`
    if (local.length <= 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }

  if (country.code === '+1') {
    const local = digits.slice(0, 10)
    if (local.length <= 3) return local ? `(${local}` : ''
    if (local.length <= 6) return `(${local.slice(0, 3)}) ${local.slice(3)}`
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
  }

  if (iso === 'PT') {
    const local = digits.slice(0, 9)
    if (local.length <= 3) return local
    if (local.length <= 6) return `${local.slice(0, 3)} ${local.slice(3)}`
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }

  return digits.slice(0, 15)
}

function phonePattern(iso: string) {
  if (iso === 'BR') return String.raw`^\([1-9]{2}\) (?:9[0-9]{4}|[2-8][0-9]{3})-[0-9]{4}$`
  if (findCountryByIso(iso).code === '+1') return String.raw`^\([0-9]{3}\) [0-9]{3}-[0-9]{4}$`
  if (iso === 'PT') return String.raw`^[0-9]{3} [0-9]{3} [0-9]{3}$`
  return String.raw`^[0-9]{6,15}$`
}

export function normalizeInternationalPhone(countryIso: string, phone: string) {
  const country = findCountryByIso(countryIso)
  const rawDigits = digitsOnly(phone)
  const dialDigits = digitsOnly(country.code)
  const localDigits = rawDigits.startsWith(dialDigits) && rawDigits.length > 10
    ? rawDigits.slice(dialDigits.length)
    : rawDigits
  if (!localDigits) return ''
  return `${country.code}${localDigits}`
}

export function InternationalPhoneField({
  phoneName,
  countryName,
  label = 'Telefone / WhatsApp',
  defaultCountryIso = 'BR',
  defaultPhone = '',
  required = false,
  className = '',
}: {
  phoneName: string
  countryName?: string
  label?: string
  defaultCountryIso?: string | null
  defaultPhone?: string | null
  required?: boolean
  className?: string
}) {
  const detectedCountry = findCountryByPhone(defaultPhone)
  const initialCountry = detectedCountry?.iso ?? findCountryByIso(defaultCountryIso).iso
  const [countryIso, setCountryIso] = useState(initialCountry)
  const [phone, setPhone] = useState(formatLocalPhone(initialCountry, defaultPhone ?? ''))
  const normalized = normalizeInternationalPhone(countryIso, phone)
  const selected = useMemo(() => findCountryByIso(countryIso), [countryIso])

  return (
    <div className={`grid gap-2 sm:grid-cols-[6.75rem_minmax(0,1fr)] ${className}`}>
      <label className="min-w-0">
        <span className="mb-1 block text-xs font-medium text-gray-600">País</span>
        <select
          name={countryName}
          value={countryIso}
          onChange={event => {
            const next = event.target.value
            setCountryIso(next)
            setPhone(formatLocalPhone(next, phone))
          }}
          className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          {PHONE_COUNTRIES.map(country => (
            <option key={`${country.iso}-${country.code}`} value={country.iso}>
              {country.iso} {country.code}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0">
        <span className="mb-1 block text-xs font-medium text-gray-600">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        <input
          value={phone}
          onChange={event => setPhone(formatLocalPhone(countryIso, event.target.value))}
          inputMode="numeric"
          required={required}
          pattern={phonePattern(countryIso)}
          placeholder={selected.iso === 'BR' ? '(41) 99999-9999' : selected.iso === 'PT' ? '912 345 678' : selected.code === '+1' ? '(212) 555-1234' : 'somente números'}
          title="Informe o telefone conforme o país selecionado."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <input type="hidden" name={phoneName} value={normalized} />
      </label>
    </div>
  )
}
