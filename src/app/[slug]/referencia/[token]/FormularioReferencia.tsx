'use client'

import { useState } from 'react'
import { salvarReferencia } from './actions'
import { InternationalPhoneField } from '@/components/ui/InternationalPhoneField'
import { HeartHandshake } from 'lucide-react'
import { LangSwitcher } from '@/components/ui/LangSwitcher'
import { getFormDict, normalizeLang, t } from '@/lib/i18n/forms'
import type { Lang } from '@/lib/i18n/forms'

type Props = {
  token: string
  tipo: 'pastor' | 'amigo'
  candidatoNome: string
  escolaNome: string
  initialLang?: string
}

function Field({ label, name, placeholder, required, type = 'text' }: {
  label: string; name: string; placeholder?: string; required?: boolean; type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input name={name} type={type} placeholder={placeholder} required={required}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
    </div>
  )
}

function TextArea({ label, name, placeholder, required, rows = 4 }: {
  label: string; name: string; placeholder?: string; required?: boolean; rows?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea name={name} placeholder={placeholder} required={required} rows={rows}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 resize-none" />
    </div>
  )
}

function Select({ label, name, required, options, selectPlaceholder }: {
  label: string; name: string; required?: boolean
  options: { value: string; label: string }[]
  selectPlaceholder: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select name={name} defaultValue="" required={required}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50">
        <option value="" disabled>{selectPlaceholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function InlineWithName({ template, name }: { template: string; name: string }) {
  const [before, after] = template.split('{name}')
  return <><strong>{name}</strong>{after ?? before}</>
}

function FormPastor({ candidatoNome, d, selectPh }: {
  candidatoNome: string
  d: ReturnType<typeof getFormDict>
  selectPh: string
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 leading-relaxed">
        <InlineWithName template={d.ref.pastor_intro} name={candidatoNome} />
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label={d.ref.pastor_nome} name="pastor_nome" required />
        </div>
        <Field label={d.ref.pastor_cargo} name="pastor_cargo" required />
        <Field label={d.ref.pastor_igreja} name="pastor_igreja" required />
        <Field label={d.ref.pastor_cidade} name="pastor_cidade" required />
        <Field label={d.ref.pastor_tempo_conhece} name="tempo_conhece" required />
        <Field label={d.ref.pastor_email} name="pastor_email" type="email" required />
        <InternationalPhoneField phoneName="pastor_telefone" countryName="pastor_telefone_country"
          label={d.ref.pastor_phone} defaultCountryIso="BR" required />

        <div className="sm:col-span-2 border-t pt-4 mt-2">
          <p className="text-sm font-semibold text-gray-700 mb-3">{d.ref.pastor_eval_title}</p>
        </div>

        <div className="sm:col-span-2">
          <TextArea
            label={t(d.ref.pastor_carater_q, { name: candidatoNome })}
            name="carater" required rows={4} />
        </div>
        <div className="sm:col-span-2">
          <TextArea
            label={d.ref.pastor_responsabilidade}
            name="responsabilidade" required rows={3} />
        </div>
        <div className="sm:col-span-2">
          <TextArea
            label={d.ref.pastor_dificuldades}
            name="dificuldades" rows={3}
            placeholder={d.ref.pastor_dificuldades_ph} />
        </div>
        <div className="sm:col-span-2">
          <TextArea
            label={d.ref.pastor_autoridade}
            name="autoridade" rows={3} />
        </div>

        <div className="sm:col-span-2">
          <Select label={d.ref.pastor_recomenda} name="recomenda" required selectPlaceholder={selectPh}
            options={[
              { value: 'sim', label: d.ref.pastor_rec_sim },
              { value: 'sim_ressalvas', label: d.ref.pastor_rec_ressalvas },
              { value: 'nao', label: d.ref.pastor_rec_nao },
            ]} />
        </div>
        <div className="sm:col-span-2">
          <TextArea label={d.ref.pastor_observacoes} name="observacoes" rows={3}
            placeholder={d.ref.pastor_observacoes_ph} />
        </div>
        <div className="sm:col-span-2">
          <Select label={t(d.ref.pastor_apoia, { name: candidatoNome })}
            name="apoia" required selectPlaceholder={selectPh}
            options={[
              { value: 'sim', label: d.ref.pastor_apoia_sim },
              { value: 'nao', label: d.ref.pastor_apoia_nao },
            ]} />
        </div>

        <div className="sm:col-span-2 border-t pt-4 mt-2">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-200">
            <input type="checkbox" name="decl_verdadeiro" value="sim" required
              className="mt-0.5 accent-indigo-600 flex-shrink-0" />
            <span className="text-sm text-gray-700">{d.ref.pastor_decl}</span>
          </label>
        </div>
      </div>
    </div>
  )
}

function FormAmigo({ candidatoNome, d, selectPh }: {
  candidatoNome: string
  d: ReturnType<typeof getFormDict>
  selectPh: string
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 leading-relaxed">
        <InlineWithName template={d.ref.amigo_intro} name={candidatoNome} />
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label={d.ref.amigo_nome} name="ref_nome" required />
        </div>
        <Field label={d.ref.amigo_como_conheceu} name="como_conheceu" required />
        <Field label={d.ref.amigo_tempo} name="tempo_conhece" required />
        <Select label={d.ref.amigo_crista} name="crista" selectPlaceholder={selectPh} options={[
          { value: 'sim', label: d.opts.yes }, { value: 'nao', label: d.opts.no },
        ]} />
        <Field label={d.ref.amigo_email} name="ref_email" type="email" required />
        <InternationalPhoneField phoneName="ref_telefone" countryName="ref_telefone_country"
          label={d.ref.amigo_phone} defaultCountryIso="BR" required />

        <div className="sm:col-span-2 border-t pt-4 mt-2">
          <p className="text-sm font-semibold text-gray-700 mb-3">{d.ref.amigo_sobre_title}</p>
        </div>

        <div className="sm:col-span-2">
          <TextArea
            label={t(d.ref.amigo_carater_q, { name: candidatoNome })}
            name="carater" required rows={4} />
        </div>
        <div className="sm:col-span-2">
          <TextArea
            label={d.ref.amigo_pontos_fortes}
            name="pontos_fortes" required rows={3} />
        </div>
        <div className="sm:col-span-2">
          <TextArea
            label={d.ref.amigo_crescimento}
            name="areas_crescimento" rows={3} />
        </div>
        <div className="sm:col-span-2">
          <TextArea
            label={t(d.ref.amigo_pressao, { name: candidatoNome })}
            name="sob_pressao" rows={3} />
        </div>
        <div className="sm:col-span-2">
          <TextArea
            label={d.ref.amigo_relacionamentos}
            name="relacionamentos" rows={3} />
        </div>

        <div className="sm:col-span-2">
          <Select label={d.ref.amigo_recomenda} name="recomenda" required selectPlaceholder={selectPh}
            options={[
              { value: 'sim', label: d.ref.pastor_rec_sim },
              { value: 'sim_ressalvas', label: d.ref.pastor_rec_ressalvas },
              { value: 'nao', label: d.ref.pastor_rec_nao },
            ]} />
        </div>
        <div className="sm:col-span-2">
          <TextArea label={d.ref.amigo_observacoes} name="observacoes" rows={3}
            placeholder={d.ref.amigo_observacoes_ph} />
        </div>

        <div className="sm:col-span-2 border-t pt-4 mt-2">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-200">
            <input type="checkbox" name="decl_verdadeiro" value="sim" required
              className="mt-0.5 accent-indigo-600 flex-shrink-0" />
            <span className="text-sm text-gray-700">{d.ref.amigo_decl}</span>
          </label>
        </div>
      </div>
    </div>
  )
}

export function FormularioReferencia({ token, tipo, candidatoNome, escolaNome, initialLang }: Props) {
  const [lang, setLang] = useState<Lang>(normalizeLang(initialLang))
  const d = getFormDict(lang)

  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const tipoLabel = tipo === 'pastor' ? d.ref.form_type_pastor : d.ref.form_type_amigo
  const selectPh = d.nav.select_placeholder

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const fd = new FormData(e.currentTarget)
      const data: Record<string, unknown> = {}
      fd.forEach((v, k) => { data[k] = v })
      const result = await salvarReferencia(token, data)
      if ('error' in result) throw new Error(result.error)
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : d.nav.error_save)
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-16 px-8">
        <HeartHandshake className="size-14 mx-auto mb-4 text-brand-500" />
        <h2 className="text-2xl font-black text-gray-900 mb-3">{d.ref.success_title}</h2>
        <p className="text-gray-600 max-w-sm mx-auto leading-relaxed">
          {t(d.ref.success_body, { school: escolaNome })}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
            {tipoLabel}
          </span>
          <LangSwitcher lang={lang} onChange={setLang} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mt-1">
          {d.ref.ref_for} <span className="text-indigo-600">{candidatoNome}</span>
        </h2>
        <div className="h-0.5 bg-indigo-100 mt-3" />
      </div>

      {tipo === 'pastor'
        ? <FormPastor candidatoNome={candidatoNome} d={d} selectPh={selectPh} />
        : <FormAmigo candidatoNome={candidatoNome} d={d} selectPh={selectPh} />
      }

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button type="submit" disabled={saving}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors">
          {saving ? d.ref.submitting : d.ref.submit}
        </button>
      </div>
    </form>
  )
}
