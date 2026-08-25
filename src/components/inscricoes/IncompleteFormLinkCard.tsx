'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

export function IncompleteFormLinkCard({ reason, formPathPrefix, onGenerateLink }: {
  reason: string
  formPathPrefix: string
  onGenerateLink: () => Promise<{ token: string }>
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

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
