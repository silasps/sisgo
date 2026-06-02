'use client'

import { useState } from 'react'
import Image from 'next/image'
import { login } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await login(new FormData(e.currentTarget))
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    // Reload completo para que o middleware leia os cookies corretamente
    window.location.href = result.redirectTo!
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <div className="absolute top-0 left-0 right-0 h-1 bg-brand-500" />

      <div className="w-full max-w-sm px-4">
        <div className="flex flex-col items-center mb-8 gap-3">
          <Image
            src="/images/logo-white.png"
            alt="JOCUM Almirante Tamandaré"
            width={180}
            height={62}
            className="object-contain"
            priority
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <p className="text-brand-400 text-xs font-medium tracking-widest uppercase">
            Sistema de Gestão
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 backdrop-blur rounded-2xl p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">E-mail</label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Senha</label>
            <input
              type="password"
              name="password"
              required
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-70 mt-2 flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-6">
          SISGO · JOCUM Almirante Tamandaré
        </p>
      </div>
    </div>
  )
}
