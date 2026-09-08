'use client'

import { useState } from 'react'
import { AlertTriangle, Pencil, Mail } from 'lucide-react'

export function IncompleteFormLinkCard({
  reason, formPathPrefix, onGenerateLink, email, onResendEmail, onEditEmail,
}: {
  reason: string
  formPathPrefix: string
  onGenerateLink: () => Promise<{ token: string }>
  email?: string | null
  onResendEmail?: () => Promise<void>
  onEditEmail?: (email: string) => Promise<void>
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [resendError, setResendError] = useState('')

  const [editingEmail, setEditingEmail] = useState(false)
  const [emailValue, setEmailValue] = useState(email ?? '')
  const [currentEmail, setCurrentEmail] = useState(email ?? '')
  const [savingEmail, setSavingEmail] = useState(false)

  async function handleResend() {
    if (!onResendEmail) return
    setResendStatus('loading')
    setResendError('')
    try {
      await onResendEmail()
      setResendStatus('sent')
      setTimeout(() => setResendStatus('idle'), 4000)
    } catch (e) {
      setResendStatus('error')
      setResendError(e instanceof Error ? e.message : 'Não foi possível reenviar.')
    }
  }

  async function handleSaveEmail() {
    if (!onEditEmail) return
    setSavingEmail(true)
    try {
      await onEditEmail(emailValue.trim())
      setCurrentEmail(emailValue.trim())
      setEditingEmail(false)
    } finally {
      setSavingEmail(false)
    }
  }

  async function copy(url: string) {
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  async function handleGenerate() {
    setStatus('loading')
    try {
      const result = await onGenerateLink()
      const url = `${window.location.origin}${formPathPrefix}/${result.token}`
      setLink(url)
      setStatus('idle')
      await copy(url)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">Formulário incompleto</p>
          <p className="text-xs text-amber-700 mt-0.5">{reason}</p>

          {onEditEmail && (
            <div className="mt-2 flex items-center gap-1.5">
              {editingEmail ? (
                <>
                  <input
                    type="email"
                    value={emailValue}
                    onChange={e => setEmailValue(e.target.value)}
                    placeholder="email@exemplo.com"
                    autoFocus
                    className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded-lg border border-amber-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button type="button" onClick={handleSaveEmail} disabled={savingEmail || !emailValue.trim()}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 disabled:opacity-50 whitespace-nowrap">
                    {savingEmail ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button type="button" onClick={() => { setEditingEmail(false); setEmailValue(currentEmail) }}
                    className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap">
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <Mail className="size-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs text-amber-800 truncate">{currentEmail || 'Sem e-mail cadastrado'}</span>
                  <button type="button" onClick={() => setEditingEmail(true)}
                    className="text-amber-600 hover:text-amber-900 shrink-0" aria-label="Editar e-mail">
                    <Pencil className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          )}

          {onResendEmail && currentEmail && (
            <div className="mt-2">
              <button type="button" onClick={handleResend} disabled={resendStatus === 'loading'}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-100 disabled:opacity-60 transition-colors">
                {resendStatus === 'loading' ? 'Reenviando…' : resendStatus === 'sent' ? '✓ E-mail reenviado' : 'Reenviar e-mail'}
              </button>
              {resendStatus === 'error' && <p className="mt-1 text-xs text-red-600">{resendError}</p>}
            </div>
          )}

          {link ? (
            <div className="mt-2.5 flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
              <input readOnly value={link}
                className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate" />
              <button type="button" onClick={() => copy(link)}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap shrink-0">
                {copied ? '✓ Copiado!' : 'Copiar'}
              </button>
            </div>
          ) : (
            <button type="button" onClick={handleGenerate} disabled={status === 'loading'}
              className="mt-2.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 transition-colors">
              {status === 'loading' ? 'Gerando link…' : 'Gerar link para reenviar'}
            </button>
          )}
          {status === 'error' && <p className="mt-1.5 text-xs text-red-600">Não foi possível gerar o link. Tente novamente.</p>}
        </div>
      </div>
    </div>
  )
}
