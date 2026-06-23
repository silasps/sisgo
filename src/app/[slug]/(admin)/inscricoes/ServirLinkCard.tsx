'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Copy, Check, Code, ChevronDown, ChevronUp } from 'lucide-react'

export function ServirLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null)
  const [showEmbed, setShowEmbed] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const publicUrl = `${origin}/${slug}/servir`
  const embedUrl = `${origin}/${slug}/servir/embed`

  const embedSnippet = `<iframe
  src="${embedUrl}"
  id="sisgo-servir-form"
  width="100%"
  height="600"
  style="border:none;display:block;"
  loading="lazy"
></iframe>
<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'sisgo-height') {
    document.getElementById('sisgo-servir-form').height = e.data.height;
  }
});
</script>`

  async function copyText(text: string, tipo: 'link' | 'embed') {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(tipo)
    setTimeout(() => setCopied(null), 2500)
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Página de pré-inscrição de obreiros</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Compartilhe este link para receber pré-inscrições de obreiros interessados.
          </p>
        </div>
        <a
          href={`/${slug}/servir`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          Abrir <ExternalLink className="size-3" />
        </a>
      </div>

      {/* Link direto */}
      <div className="flex items-center gap-2 bg-white border border-amber-100 rounded-lg px-3 py-2">
        <input
          readOnly
          value={origin ? publicUrl : 'Carregando…'}
          className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate font-mono"
        />
        <button
          onClick={() => copyText(publicUrl, 'link')}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors"
        >
          {copied === 'link' ? <><Check className="size-3" /> Copiado!</> : <><Copy className="size-3" /> Copiar</>}
        </button>
      </div>

      {/* Toggle embed */}
      <button
        type="button"
        onClick={() => setShowEmbed(!showEmbed)}
        className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Code className="size-3.5" />
        Código de incorporação
        {showEmbed ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {showEmbed && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600">Embed (iframe)</p>
            <button
              onClick={() => copyText(embedSnippet, 'embed')}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                copied === 'embed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
              }`}
            >
              {copied === 'embed' ? '✓ Copiado!' : 'Copiar'}
            </button>
          </div>
          <pre className="p-3 text-xs text-gray-500 overflow-x-auto whitespace-pre font-mono leading-relaxed select-all">
            {origin ? embedSnippet : 'Carregando…'}
          </pre>
          <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">
              Cole este código no HTML do seu site. O iframe se redimensiona automaticamente.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
