'use client'

import { useState } from 'react'
import { submitPreRegistration } from './actions'

type ClassOption = { id: string; name: string; year: number | null; semester: number | null }

export function RegistrationForm({
  orgId,
  schoolId,
  classes,
}: {
  orgId: string
  schoolId: string
  classes: ClassOption[]
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const form = e.currentTarget
    const data = new FormData(form)

    const result = await submitPreRegistration({
      orgId,
      schoolId,
      classId: data.get('classId') as string || null,
      fullName: data.get('fullName') as string,
      email: data.get('email') as string,
      phone: data.get('phone') as string || null,
      message: data.get('message') as string || null,
    })

    if (result.success) {
      setStatus('success')
      form.reset()
    } else {
      setStatus('error')
      setErrorMsg(result.error ?? 'Ocorreu um erro. Tente novamente.')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-16 px-8 bg-brand-50 rounded-3xl border border-brand-100">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="text-2xl font-black text-gray-950 mb-2">Pré-inscrição recebida!</h3>
        <p className="text-gray-600">Nossa equipe entrará em contato em breve com os próximos passos.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Nome completo *</label>
          <input
            name="fullName"
            required
            placeholder="Seu nome completo"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 placeholder-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">E-mail *</label>
          <input
            name="email"
            type="email"
            required
            placeholder="seu@email.com"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 placeholder-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Telefone / WhatsApp</label>
          <input
            name="phone"
            type="tel"
            placeholder="(00) 00000-0000"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 placeholder-gray-400"
          />
        </div>
        {classes.length > 0 && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Turma de interesse</label>
            <select
              name="classId"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900"
            >
              <option value="">Não tenho preferência</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.year ? ` — ${c.year}` : ''}{c.semester ? ` / ${c.semester}º semestre` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Mensagem (opcional)</label>
          <textarea
            name="message"
            rows={3}
            placeholder="Conte um pouco sobre você ou tire uma dúvida..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-gray-900 placeholder-gray-400 resize-none"
          />
        </div>
      </div>

      {status === 'error' && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-bold py-4 rounded-2xl text-lg transition-all hover:scale-[1.02] shadow-lg shadow-brand-500/20"
      >
        {status === 'loading' ? 'Enviando...' : 'Enviar pré-inscrição'}
      </button>

      <p className="text-center text-xs text-gray-400">
        Ao enviar, você concorda em ser contatado pela equipe da base.
      </p>
    </form>
  )
}
