'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { SisgoLogo } from '@/components/layout/Logo'
import { createClient } from '@/lib/supabase/client'
import { getLoginRedirect, register, loginWithGoogle } from './actions'

function isNativePlatform() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Capacitor } = require('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch { return false }
}

function LoginPageInner() {
  const params = useSearchParams()
  const [tab, setTab] = useState<'login' | 'cadastro'>(
    params.get('tab') === 'cadastro' ? 'cadastro' : 'login'
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    if (!isNativePlatform()) return
    let cleanup: (() => void) | undefined

    import('@capacitor/app').then(({ App }) => {
      const listener = App.addListener('appUrlOpen', async ({ url }) => {
        const parsed = new URL(url)
        const accessToken = parsed.searchParams.get('access_token')
        const refreshToken = parsed.searchParams.get('refresh_token')
        if (accessToken && refreshToken) {
          const supabase = createClient()
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          const { Browser } = await import('@capacitor/browser')
          await Browser.close()
          localStorage.setItem('sisgo_has_session', '1')
          const result = await getLoginRedirect()
          if (result.redirectTo) window.location.href = result.redirectTo
        }
        setGoogleLoading(false)
      })
      cleanup = () => { listener.then(h => h.remove()) }
    })

    return () => cleanup?.()
  }, [])

  async function handleGoogle() {
    setGoogleLoading(true); setError(null)
    const native = isNativePlatform()
    const result = await loginWithGoogle(native)
    if ('error' in result && result.error) { setError(result.error); setGoogleLoading(false); return }
    const url = (result as { redirectTo: string }).redirectTo
    if (native) {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url, presentationStyle: 'popover' })
      return
    }
    localStorage.setItem('sisgo_has_session', '1')
    window.location.href = url
  }

  useEffect(() => {
    if (params.get('tab') === 'cadastro') setTab('cadastro')
  }, [params])

  useEffect(() => {
    let active = true

    async function redirectAuthenticatedUser() {
      const { data: { user } } = await createClient().auth.getUser()
      if (!active || !user) return

      const result = await getLoginRedirect()
      if (!active || result.error || !result.redirectTo) return
      localStorage.setItem('sisgo_has_session', '1')
      window.location.replace(result.redirectTo)
    }

    redirectAuthenticatedUser()

    return () => {
      active = false
    }
  }, [])

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError(null)

    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: String(formData.get('email') ?? '').trim(),
        password: String(formData.get('password') ?? ''),
      })

      if (authError) {
        setError('E-mail ou senha inválidos.')
        setLoading(false)
        return
      }
    } catch {
      setError('Erro inesperado ao conectar. Tente novamente.')
      setLoading(false)
      return
    }

    const result = await getLoginRedirect()
    if (result.error) { setError(result.error); setLoading(false); return }

    localStorage.setItem('sisgo_has_session', '1')

    // Timeout: se o redirect não ocorrer em 10s, informa o usuário
    const timeout = setTimeout(() => {
      setLoading(false)
      setError('A navegação está demorando mais que o esperado. Tente atualizar a página.')
    }, 10000)

    try {
      window.location.href = result.redirectTo!
    } catch {
      clearTimeout(timeout)
      setLoading(false)
      setError('Não foi possível redirecionar. Tente novamente.')
    }
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
    const msg = result.needsEmailConfirm
      ? 'Conta criada! Verifique seu e-mail para confirmar o acesso.'
      : 'Conta criada! Aguarde um administrador vincular sua conta a uma base.'
    setSuccess(msg)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4">
      <div className="absolute top-0 left-0 right-0 h-1 bg-brand-500" />

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/">
            <SisgoLogo size={38} />
          </Link>
          <p className="text-brand-400 text-xs font-medium tracking-widest uppercase mt-3">
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

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-3 py-2.5 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-lg text-sm transition-colors disabled:opacity-70 mb-4"
        >
          {googleLoading ? (
            <svg className="animate-spin h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {googleLoading ? 'Redirecionando...' : 'Continuar com Google'}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-gray-500">ou</span>
          <div className="flex-1 h-px bg-white/10" />
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
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
