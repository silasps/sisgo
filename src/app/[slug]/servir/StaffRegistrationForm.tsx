'use client'

import { useState, useEffect } from 'react'
import { submitStaffPreRegistration } from './actions'
import { PHONE_COUNTRIES, LANGUAGES, formatPhoneByDialCode, guessLanguageCode } from '@/lib/i18n/phoneCountries'
import { PartyPopper } from 'lucide-react'
import { LangSwitcher } from '@/components/ui/LangSwitcher'
import { getFormDict, normalizeLang } from '@/lib/i18n/forms'
import type { Lang } from '@/lib/i18n/forms'

type MinistryOption = { id: string; name: string }
type SchoolOption = { id: string; name: string }

const PHONE_PLACEHOLDERS: Record<string, string> = {
  '+55': '(41) 99999-9999',
  '+1': '(212) 555-1234',
  '+351': '912 345 678',
  '+54': '11 1234-5678',
  '+34': '612 345 678',
  '+44': '7911 123456',
}

export function StaffRegistrationForm({
  slug,
  ministries,
  schools = [],
  communicationLanguages = [],
  initialLang,
  lockedMinistryId,
  lockedMinistryName,
}: {
  slug: string
  ministries: MinistryOption[]
  schools?: SchoolOption[]
  communicationLanguages?: string[]
  initialLang?: string
  lockedMinistryId?: string
  lockedMinistryName?: string
}) {
  const [lang, setLang] = useState<Lang>(normalizeLang(initialLang))
  const d = getFormDict(lang)

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [phoneCountry, setPhoneCountry] = useState('+55')
  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [nativeLanguage, setNativeLanguage] = useState('')

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const guess = guessLanguageCode(navigator.languages ?? [navigator.language])
    if (guess) setNativeLanguage(guess)
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg('')

    const form = e.currentTarget
    const data = new FormData(form)

    const email = ((data.get('email') as string) || '').trim()
    const rawPhone = (data.get('phone_number') as string)?.trim()
    const phone = rawPhone ? `${phoneCountry}${rawPhone.replace(/\D/g, '')}` : null

    if (!email && !phone) {
      setStatus('error')
      setErrorMsg(t.contact_required)
      return
    }

    setStatus('loading')

    const destination = lockedMinistryId ? `ministry:${lockedMinistryId}` : (data.get('destination') as string) || ''
    const [destType, destId] = destination.includes(':') ? destination.split(':') : [null, null]

    const result = await submitStaffPreRegistration({
      slug,
      ministryId: destType === 'ministry' ? destId : null,
      schoolId: destType === 'school' ? destId : null,
      fullName: data.get('fullName') as string,
      email: email || null,
      phone,
      phoneCountry: rawPhone ? phoneCountry : null,
      language: (data.get('language') as string) || null,
      communicationLanguage: (data.get('communicationLanguage') as string) || null,
      message: (data.get('message') as string) || null,
    })

    if (result.success) {
      setStatus('success')
      form.reset()
      setPhoneCountry('+55')
      setPhoneDisplay('')
      setNativeLanguage('')
    } else {
      setStatus('error')
      setErrorMsg(result.error ?? d.registration.error_fallback)
    }
  }

  const labels = {
    pt: {
      title_pre: 'Pré-inscrição',
      title: 'Venha servir conosco',
      subtitle: 'Preencha abaixo e nossa equipe entrará em contato com mais detalhes.',
      name: 'Nome completo',
      name_ph: 'Seu nome completo',
      email: 'E-mail',
      email_ph: 'seu@email.com',
      phone: 'Telefone / WhatsApp',
      contact_hint: 'Informe pelo menos um: e-mail ou telefone/WhatsApp.',
      contact_required: 'Informe pelo menos um contato: e-mail ou telefone/WhatsApp.',
      ministry: 'Ministério de interesse',
      ministry_ph: 'Nenhuma preferência',
      message: 'Mensagem',
      message_optional: '(opcional)',
      message_ph: 'Conte-nos um pouco sobre você e sua motivação…',
      submit: 'Enviar pré-inscrição',
      submitting: 'Enviando…',
      consent: 'Ao enviar, você concorda em ser contatado pela nossa equipe.',
      success_title: 'Pré-inscrição enviada!',
      success_body: 'Recebemos sua solicitação. Nossa equipe entrará em contato em breve.',
    },
    en: {
      title_pre: 'Pre-registration',
      title: 'Come serve with us',
      subtitle: 'Fill in below and our team will reach out with more details.',
      name: 'Full name',
      name_ph: 'Your full name',
      email: 'Email',
      email_ph: 'your@email.com',
      phone: 'Phone / WhatsApp',
      contact_hint: 'Provide at least one: email or phone/WhatsApp.',
      contact_required: 'Please provide at least one contact: email or phone/WhatsApp.',
      ministry: 'Ministry of interest',
      ministry_ph: 'No preference',
      message: 'Message',
      message_optional: '(optional)',
      message_ph: 'Tell us a bit about yourself and your motivation…',
      submit: 'Submit pre-registration',
      submitting: 'Submitting…',
      consent: 'By submitting, you agree to be contacted by our team.',
      success_title: 'Pre-registration sent!',
      success_body: 'We received your request. Our team will be in touch soon.',
    },
    es: {
      title_pre: 'Pre-inscripción',
      title: 'Ven a servir con nosotros',
      subtitle: 'Rellena abajo y nuestro equipo se pondrá en contacto contigo.',
      name: 'Nombre completo',
      name_ph: 'Tu nombre completo',
      email: 'Correo electrónico',
      email_ph: 'tu@email.com',
      phone: 'Teléfono / WhatsApp',
      contact_hint: 'Indica al menos uno: correo electrónico o teléfono/WhatsApp.',
      contact_required: 'Indica al menos un contacto: correo electrónico o teléfono/WhatsApp.',
      ministry: 'Ministerio de interés',
      ministry_ph: 'Sin preferencia',
      message: 'Mensaje',
      message_optional: '(opcional)',
      message_ph: 'Cuéntanos un poco sobre ti y tu motivación…',
      submit: 'Enviar pre-inscripción',
      submitting: 'Enviando…',
      consent: 'Al enviar, aceptas ser contactado por nuestro equipo.',
      success_title: '¡Pre-inscripción enviada!',
      success_body: 'Recibimos tu solicitud. Nuestro equipo se pondrá en contacto pronto.',
    },
  }

  const t = labels[lang] ?? labels.pt

  if (status === 'success') {
    return (
      <div className="text-center py-16 px-8 bg-brand-50 rounded-3xl border border-brand-100">
        <PartyPopper className="size-12 mx-auto mb-4 text-brand-500" />
        <h3 className="text-2xl font-black text-gray-950 mb-2">{t.success_title}</h3>
        <p className="text-gray-600">{t.success_body}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex justify-end">
        <LangSwitcher lang={lang} onChange={setLang} uiLabel={d.langSwitcher.label} />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{t.name} *</label>
        <input
          name="fullName"
          required
          placeholder={t.name_ph}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 placeholder-gray-400"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{t.email}</label>
        <input
          name="email"
          type="email"
          placeholder={t.email_ph}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 placeholder-gray-400"
        />
        <p className="text-xs text-gray-400 mt-1.5">{t.contact_hint}</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {d.registration.language} *
        </label>
        <select
          name="language"
          required
          value={nativeLanguage}
          onChange={e => setNativeLanguage(e.target.value)}
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

      {communicationLanguages.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {d.registration.communication_language}
          </label>
          <select
            name="communicationLanguage"
            defaultValue=""
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900"
          >
            <option value="" disabled>{d.registration.communication_language_ph}</option>
            {LANGUAGES.filter(l => communicationLanguages.includes(l.code)).map(l => (
              <option key={l.code} value={l.code}>
                {l.label}{l.nativeLabel !== l.label ? ` — ${l.nativeLabel}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{t.phone}</label>
        <div className="flex gap-2">
          <div className="flex-shrink-0">
            <select
              value={phoneCountry}
              onChange={e => {
                setPhoneCountry(e.target.value)
                setPhoneDisplay(formatPhoneByDialCode(e.target.value, phoneDisplay))
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
          <input
            name="phone_number"
            type="tel"
            inputMode="numeric"
            value={phoneDisplay}
            onChange={e => setPhoneDisplay(formatPhoneByDialCode(phoneCountry, e.target.value))}
            placeholder={PHONE_PLACEHOLDERS[phoneCountry] ?? 'somente números'}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 placeholder-gray-400"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          {PHONE_COUNTRIES.find(c => c.code === phoneCountry)?.flag}{' '}
          {PHONE_COUNTRIES.find(c => c.code === phoneCountry)?.name} — código {phoneCountry}
        </p>
      </div>

      {lockedMinistryId ? (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t.ministry}</label>
          <p className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900">
            {lockedMinistryName}
          </p>
        </div>
      ) : (ministries.length > 0 || schools.length > 0) && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t.ministry}</label>
          <select
            name="destination"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900"
          >
            <option value="">{t.ministry_ph}</option>
            {ministries.length > 0 && (
              <optgroup label="Ministérios">
                {ministries.map(m => (
                  <option key={m.id} value={`ministry:${m.id}`}>{m.name}</option>
                ))}
              </optgroup>
            )}
            {schools.length > 0 && (
              <optgroup label="Escolas">
                {schools.map(s => (
                  <option key={s.id} value={`school:${s.id}`}>{s.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t.message}{' '}
          <span className="text-xs font-normal text-gray-400">{t.message_optional}</span>
        </label>
        <textarea
          name="message"
          rows={3}
          placeholder={t.message_ph}
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
        {status === 'loading' ? t.submitting : t.submit}
      </button>

      <p className="text-center text-xs text-gray-400">{t.consent}</p>
    </form>
  )
}
