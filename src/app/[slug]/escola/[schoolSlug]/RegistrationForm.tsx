'use client'

import { useState } from 'react'
import { submitPreRegistration } from './actions'
import { PHONE_COUNTRIES, LANGUAGES } from '@/lib/i18n/phoneCountries'
import { PartyPopper } from 'lucide-react'
import { LangSwitcher } from '@/components/ui/LangSwitcher'
import { getFormDict, normalizeLang } from '@/lib/i18n/forms'
import type { Lang } from '@/lib/i18n/forms'

type ClassOption = { id: string; name: string; year: number | null; semester: number | null }

export function RegistrationForm({
  slug,
  schoolSlug,
  classes,
  initialLang,
}: {
  slug: string
  schoolSlug: string
  classes: ClassOption[]
  initialLang?: string
}) {
  const [lang, setLang] = useState<Lang>(normalizeLang(initialLang))
  const d = getFormDict(lang)

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [phoneCountry, setPhoneCountry] = useState('+55')
  const [phoneDisplay, setPhoneDisplay] = useState('')

  function applyPhoneMask(raw: string, dialCode: string): string {
    const d = raw.replace(/\D/g, '')
    if (dialCode === '+55') {
      const local = d.slice(0, 11)
      if (local.length <= 2) return local ? `(${local}` : ''
      if (local.length <= 6) return `(${local.slice(0, 2)}) ${local.slice(2)}`
      if (local.length <= 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
      return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
    }
    return d.slice(0, 15)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const form = e.currentTarget
    const data = new FormData(form)

    // Monta o telefone completo: código do país + número limpo
    const rawPhone = (data.get('phone_number') as string)?.trim()
    const phone = rawPhone ? `${phoneCountry}${rawPhone.replace(/\D/g, '')}` : null

    const result = await submitPreRegistration({
      slug,
      schoolSlug,
      classId: data.get('classId') as string || null,
      fullName: data.get('fullName') as string,
      email: data.get('email') as string,
      phone,
      phoneCountry: rawPhone ? phoneCountry : null,
      language: data.get('language') as string || null,
      message: data.get('message') as string || null,
    })

    if (result.success) {
      setStatus('success')
      form.reset()
      setPhoneCountry('+55')
      setPhoneDisplay('')
    } else {
      setStatus('error')
      setErrorMsg(result.error ?? d.registration.error_fallback)
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-16 px-8 bg-brand-50 rounded-3xl border border-brand-100">
        <PartyPopper className="size-12 mx-auto mb-4 text-brand-500" />
        <h3 className="text-2xl font-black text-gray-950 mb-2">{d.registration.success_title}</h3>
        <p className="text-gray-600">{d.registration.success_body}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Lang switcher */}
      <div className="flex justify-end">
        <LangSwitcher lang={lang} onChange={setLang} uiLabel={d.langSwitcher.label} />
      </div>

      {/* Nome */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{d.registration.full_name} *</label>
        <input
          name="fullName"
          required
          placeholder={d.registration.full_name_ph}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 placeholder-gray-400"
        />
      </div>

      {/* E-mail */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{d.registration.email} *</label>
        <input
          name="email"
          type="email"
          required
          placeholder={d.registration.email_ph}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 placeholder-gray-400"
        />
      </div>

      {/* Idioma */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {d.registration.language} *
        </label>
        <select
          name="language"
          required
          defaultValue=""
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900"
        >
          <option value="" disabled>{d.registration.language_ph}</option>
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>
              {l.label}{l.nativeLabel !== l.label ? ` — ${l.nativeLabel}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Telefone / WhatsApp */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {d.registration.phone}
          <span className="ml-1 text-xs font-normal text-gray-400">{d.registration.phone_optional}</span>
        </label>
        <div className="flex gap-2">
          {/* Código do país */}
          <div className="flex-shrink-0">
            <select
              value={phoneCountry}
              onChange={e => {
                setPhoneCountry(e.target.value)
                setPhoneDisplay(applyPhoneMask(phoneDisplay, e.target.value))
              }}
              className="h-full px-2 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 text-sm min-w-[110px]"
              aria-label="Código do país"
            >
              {PHONE_COUNTRIES.map(c => (
                <option key={`${c.iso}-${c.code}`} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
          </div>
          {/* Número */}
          <input
            name="phone_number"
            type="tel"
            inputMode="numeric"
            value={phoneDisplay}
            onChange={e => setPhoneDisplay(applyPhoneMask(e.target.value, phoneCountry))}
            placeholder={phoneCountry === '+55' ? '(41) 99999-9999' : 'somente números'}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 placeholder-gray-400"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          {PHONE_COUNTRIES.find(c => c.code === phoneCountry)?.flag}{' '}
          {PHONE_COUNTRIES.find(c => c.code === phoneCountry)?.name} — código {phoneCountry}
        </p>
      </div>

      {/* Turma de interesse */}
      {classes.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{d.registration.class_interest}</label>
          <select
            name="classId"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900"
          >
            <option value="">{d.registration.class_no_pref}</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.year ? ` — ${c.year}` : ''}{c.semester ? ` / ${c.semester}º semestre` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Mensagem */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {d.registration.message}{' '}
          <span className="text-xs font-normal text-gray-400">{d.registration.message_optional}</span>
        </label>
        <textarea
          name="message"
          rows={3}
          placeholder={d.registration.message_ph}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 placeholder-gray-400 resize-none"
        />
      </div>

      {status === 'error' && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-bold py-4 rounded-2xl text-lg transition-all hover:scale-[1.02] shadow-lg shadow-brand-500/20"
      >
        {status === 'loading' ? d.registration.submitting : d.registration.submit}
      </button>

      <p className="text-center text-xs text-gray-400">
        {d.registration.contact_consent}
      </p>
    </form>
  )
}
