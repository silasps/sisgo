'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { enviarRespostaPesquisaHospitalidade } from './actions'

type Props = { slug: string; schoolSlug: string }

function TextArea({ label, name, placeholder, rows = 4 }: {
  label: string; name: string; placeholder?: string; rows?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}<span className="text-red-500 ml-0.5">*</span>
      </label>
      <textarea name={name} placeholder={placeholder} required rows={rows}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 resize-none" />
    </div>
  )
}

export function PesquisaHospitalidadeForm({ slug, schoolSlug }: Props) {
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const fd = new FormData(e.currentTarget)
      const result = await enviarRespostaPesquisaHospitalidade({
        slug,
        schoolSlug,
        respondentName: String(fd.get('respondent_name') ?? ''),
        experienceFeedback: String(fd.get('experience_feedback') ?? ''),
        favoriteClassFeedback: String(fd.get('favorite_class_feedback') ?? ''),
        improvementSuggestion: String(fd.get('improvement_suggestion') ?? ''),
      })
      if ('error' in result) throw new Error(result.error)
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar sua resposta. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-16 px-4">
        <Heart className="size-14 mx-auto mb-4 text-brand-500" />
        <h2 className="text-2xl font-black text-gray-900 mb-3">Obrigado pela sua resposta!</h2>
        <p className="text-gray-600 max-w-sm mx-auto leading-relaxed">
          Sua opinião nos ajuda a melhorar os próximos seminários.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <TextArea
        label="Como foi sua experiência ao participar do seminário?"
        name="experience_feedback"
        placeholder="Conte um pouco sobre como foi participar..."
      />
      <TextArea
        label="Qual aula mais falou com você? Por quê?"
        name="favorite_class_feedback"
        placeholder="Qual aula te marcou e por quê..."
      />
      <TextArea
        label="O que você melhoraria para os próximos seminários?"
        name="improvement_suggestion"
        placeholder="Sugestões, críticas, ideias..."
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Seu nome <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input name="respondent_name" type="text" placeholder="Se quiser se identificar"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50" />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</p>
      )}

      <button type="submit" disabled={saving}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-semibold rounded-xl py-3 text-sm transition-colors">
        {saving ? 'Enviando...' : 'Enviar resposta'}
      </button>
    </form>
  )
}
