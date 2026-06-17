'use client'

import { useState } from 'react'
import { gerarLinkReferencia } from '@/app/[slug]/formulario/[token]/actions'
import { Link as LinkIcon } from 'lucide-react'

export function GerarLinkRefBtn({ slug, applicationId, tipo }: {
  slug: string
  applicationId: string
  tipo: 'pastor' | 'amigo'
}) {
  const [link, setLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGerar() {
    setLoading(true)
    const result = await gerarLinkReferencia(slug, applicationId, tipo)
    if ('url' in result && result.url) {
      setLink(result.url)
      await navigator.clipboard.writeText(result.url).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
    setLoading(false)
  }

  async function handleCopy() {
    if (!link) return
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  if (!link) {
    return (
      <button onClick={handleGerar} disabled={loading}
        className="mt-3 w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 text-indigo-700 text-xs font-semibold rounded-lg transition-colors">
        {loading ? 'Gerando…' : <><LinkIcon className="size-3.5 inline -mt-0.5" /> Gerar link para enviar</>}
      </button>
    )
  }

  return (
    <div className="mt-3 flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-2">
      <input readOnly value={link} className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate" />
      <button onClick={handleCopy} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap">
        {copied ? '✓ Copiado!' : 'Copiar'}
      </button>
    </div>
  )
}
