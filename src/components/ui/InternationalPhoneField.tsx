'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
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

function CountryDropdown({
  value,
  onChange,
  accentRing = 'ring-brand-400',
}: {
  value: string
  onChange: (iso: string) => void
  accentRing?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const selected = useMemo(() => findCountryByIso(value), [value])

  const filtered = useMemo(
    () =>
      PHONE_COUNTRIES.filter(
        c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search) ||
          c.iso.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  )

  useEffect(() => {
    if (!open) return
    setTimeout(() => searchRef.current?.focus(), 0)
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 h-full w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:${accentRing} hover:border-gray-400 transition-colors`}
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span className="font-medium text-gray-700 tabular-nums">{selected.code}</span>
        <ChevronDown className="size-3.5 text-gray-400 ml-0.5 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar país..."
              className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div className="overflow-y-auto max-h-52">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nenhum país encontrado</p>
            ) : (
              filtered.map(c => (
                <button
                  key={`${c.iso}-${c.code}`}
                  type="button"
                  onClick={() => {
                    onChange(c.iso)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                    c.iso === value
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-gray-400 text-xs tabular-nums shrink-0">{c.code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function InternationalPhoneField({
  phoneName,
  countryName,
  label = 'Telefone / WhatsApp',
  defaultCountryIso = 'BR',
  defaultPhone = '',
  required = false,
  className = '',
  accentRing = 'ring-brand-400',
}: {
  phoneName: string
  countryName?: string
  label?: string
  defaultCountryIso?: string | null
  defaultPhone?: string | null
  required?: boolean
  className?: string
  accentRing?: string
}) {
  const detectedCountry = findCountryByPhone(defaultPhone)
  const initialCountry = detectedCountry?.iso ?? findCountryByIso(defaultCountryIso).iso
  const [countryIso, setCountryIso] = useState(initialCountry)
  const [phone, setPhone] = useState(formatLocalPhone(initialCountry, defaultPhone ?? ''))
  const normalized = normalizeInternationalPhone(countryIso, phone)
  const selected = useMemo(() => findCountryByIso(countryIso), [countryIso])

  function handleCountryChange(iso: string) {
    setCountryIso(iso)
    setPhone(formatLocalPhone(iso, phone))
  }

  const placeholder =
    selected.iso === 'BR'
      ? '(41) 99999-9999'
      : selected.iso === 'PT'
        ? '912 345 678'
        : selected.code === '+1'
          ? '(212) 555-1234'
          : 'somente números'

  return (
    <div className={`space-y-1 ${className}`}>
      <span className="block text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <div className="flex gap-2">
        <CountryDropdown value={countryIso} onChange={handleCountryChange} accentRing={accentRing} />
        <input
          value={phone}
          onChange={e => setPhone(formatLocalPhone(countryIso, e.target.value))}
          inputMode="numeric"
          required={required}
          pattern={phonePattern(countryIso)}
          placeholder={placeholder}
          title="Informe o telefone conforme o país selecionado."
          className={`flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:${accentRing}`}
        />
      </div>
      {countryName && <input type="hidden" name={countryName} value={countryIso} />}
      <input type="hidden" name={phoneName} value={normalized} />
    </div>
  )
}
