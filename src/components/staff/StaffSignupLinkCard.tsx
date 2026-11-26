'use client'

import { useState } from 'react'
import { Check, Copy, Link as LinkIcon, MessageCircle } from 'lucide-react'

// Link de inscrição de obreiro sempre à vista no Quadro de Obreiros (antes só
// existia dentro do modal de "Enviar formulário direto" e só pra ministério
// com página pública — ver lib/staff/signupLink). `children` = ações extras
// (o botão de formulário direto).
export function StaffSignupLinkCard({ url, unitLabel, children }: {
  url: string
  unitLabel: string
  children?: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copie o link:', url)
    }
  }

  const whatsappText = encodeURIComponent(`Quer servir em ${unitLabel}? Faça sua inscrição por aqui: ${url}`)

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-violet-900">Link de inscrição de obreiro</p>
        <p className="text-xs text-violet-800/70 mt-0.5">
          Divulgue (WhatsApp, Instagram, site): quem preencher já chega com {unitLabel} escolhido.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-white px-3 py-2">
        <LinkIcon className="size-3.5 shrink-0 text-violet-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{url}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 sm:flex-none"
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? 'Copiado!' : 'Copiar link'}
        </button>
        <a
          href={`https://wa.me/?text=${whatsappText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-white px-3 py-2 text-xs font-semibold text-green-700 transition-colors hover:bg-green-50 sm:flex-none"
        >
          <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
        </a>
        {children}
      </div>
    </div>
  )
}
