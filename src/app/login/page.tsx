'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { login, register } from './actions'

export default function LoginPage() {
  const params = useSearchParams()
  const [tab, setTab] = useState<'login' | 'cadastro'>(
    params.get('tab') === 'cadastro' ? 'cadastro' : 'login'
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (params.get('tab') === 'cadastro') setTab('cadastro')
  }, [params])

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError(null)
    const result = await login(new FormData(e.currentTarget))
    if (result.error) { setError(result.error); setLoading(false); return }
    window.location.href = result.redirectTo!
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError(null); setSuccess(null)
    const fd = new FormData(e.currentTarget)
    if (fd.get('password') !== fd.get('confirmPassword')) {
      setError('As senhas não coincidem.')
      setLoading(false)
      return
    }
    const result = await register(fd)
    if (result.error) { setError(result.error); setLoading(false); return }
    setSuccess('Conta criada! Verifique seu e-mail para confirmar o acesso.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4">
      <div className="absolute top-0 left-0 right-0 h-1 bg-brand-500" />

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/">
            <Image
              src="/images/logo-white.png"
              alt="JOCUM A.T."
              width={160}
              height={55}
              className="object-contain"
              priority
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </Link>
          <p className="text-brand-400 text-xs font-medium tracking-widest uppercase mt-2">
            Sistema de Gestão
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/10 rounded-xl p-1 mb-6">
          {(['login', 'cadastro'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); setSuccess(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        {/* Login */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="E-mail" name="email" type="email" placeholder="seu@email.com" />
            <Field label="Senha" name="password" type="password" placeholder="••••••••" />
            {error && <Err msg={error} />}
            <SubmitBtn loading={loading} label="Entrar" loadingLabel="Entrando..." />
          </form>
        )}

        {/* Cadastro */}
        {tab === 'cadastro' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <Field label="Nome completo" name="name" placeholder="Seu nome" />
            <Field label="E-mail" name="email" type="email" placeholder="seu@email.com" />
            <PasswordField
              label="Senha"
              name="password"
              placeholder="Mínimo 6 caracteres"
              show={showPassword}
              onToggle={() => setShowPassword(v => !v)}
            />
            <PasswordField
              label="Confirmar senha"
              name="confirmPassword"
              placeholder="Repita a senha"
              show={showConfirm}
              onToggle={() => setShowConfirm(v => !v)}
            />
            {error && <Err msg={error} />}
            {success && (
              <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                {success}
              </p>
            )}
            <SubmitBtn loading={loading} label="Criar conta" loadingLabel="Criando..." />
            <p className="text-xs text-gray-500 text-center">
              Após criar sua conta, um administrador irá vinculá-la à sua base.
            </p>
          </form>
        )}

        <p className="text-center mt-6">
          <Link href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  )
}

function Field({ label, name, type = 'text', placeholder }: {
  label: string; name: string; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      <input
        type={type} name={name} required placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  )
}

function PasswordField({ label, name, placeholder, show, onToggle }: {
  label: string; name: string; placeholder?: string; show: boolean; onToggle: () => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          name={name}
          required
          placeholder={placeholder}
          className="w-full px-3 py-2.5 pr-10 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
          tabIndex={-1}
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

function Err({ msg }: { msg: string }) {
  return (
    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{msg}</p>
  )
}

function SubmitBtn({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit" disabled={loading}
      className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {loading ? loadingLabel : label}
    </button>
  )
}
