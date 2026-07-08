'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Copy, Check, Code, ChevronDown, ChevronUp } from 'lucide-react'

type MinistryLink = {
  slug: string
  name: string
}

function buildEmbedSnippet(embedUrl: string, slug: string) {
  return `<style>html{scroll-behavior:smooth}</style>
<div id="inscricao" style="min-width:320px;max-width:900px;margin:0 auto;width:100%">
  <iframe
    src="${embedUrl}"
    id="sisgo-form-${slug}"
    width="100%"
    height="600"
    style="border:none;display:block;min-width:320px;"
    loading="lazy"
  ></iframe>
</div>
<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'sisgo-height') {
    var el = document.getElementById('sisgo-form-${slug}');
    if (el) el.style.height = e.data.height + 'px';
  }
});
</script>`
}

export function MinistryLinkCard({ orgSlug, ministries }: { orgSlug: string; ministries: MinistryLink[] }) {
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedEmbed, setExpandedEmbed] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2500)
  }

  if (ministries.length === 0) return null

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">Formulário de pré-inscrição por ministério</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Compartilhe o link direto de cada ministério para receber pré-inscrições já direcionadas.
        </p>
      </div>

      {ministries.map(ministry => {
        const publicUrl = `${origin}/${orgSlug}/servir/${ministry.slug}/inscricao`
        const embedUrl = `${origin}/${orgSlug}/servir/${ministry.slug}/embed`
        const embedSnippet = buildEmbedSnippet(embedUrl, ministry.slug)
        const isExpanded = expandedEmbed === ministry.slug
        const linkKey = `link-${ministry.slug}`
        const embedKey = `embed-${ministry.slug}`

        return (
          <div key={ministry.slug} className="space-y-2">
            <p className="text-xs font-semibold text-amber-700">{ministry.name}</p>

            <div className="flex items-center gap-2 bg-white border border-amber-100 rounded-lg px-3 py-2">
              <input
                readOnly
                value={origin ? publicUrl : 'Carregando…'}
                className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate font-mono"
              />
              <button
                onClick={() => copyText(publicUrl, linkKey)}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors"
              >
                {copied === linkKey ? <><Check className="size-3" /> Copiado!</> : <><Copy className="size-3" /> Copiar</>}
              </button>
              <a
                href={`/${orgSlug}/servir/${ministry.slug}/inscricao`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors"
              >
                <ExternalLink className="size-3" />
              </a>
            </div>

            <button
              type="button"
              onClick={() => setExpandedEmbed(isExpanded ? null : ministry.slug)}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Code className="size-3.5" />
              Código de incorporação
              {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>

            {isExpanded && (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-600">Embed (iframe)</p>
                  <button
                    onClick={() => copyText(embedSnippet, embedKey)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                      copied === embedKey
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                    }`}
                  >
                    {copied === embedKey ? '✓ Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre className="p-3 text-xs text-gray-500 overflow-x-auto whitespace-pre font-mono leading-relaxed select-all">
                  {origin ? embedSnippet : 'Carregando…'}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
