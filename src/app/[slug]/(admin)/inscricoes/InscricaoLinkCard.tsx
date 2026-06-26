'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Copy, Check, Code, ChevronDown, ChevronUp } from 'lucide-react'

type SchoolLink = {
  slug: string
  name: string
}

export function InscricaoLinkCard({ orgSlug, schools }: { orgSlug: string; schools: SchoolLink[] }) {
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

  if (schools.length === 0) return null

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-brand-50 border border-indigo-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">Formulário de pré-inscrição</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Compartilhe o link direto para receber pré-inscrições de alunos interessados.
        </p>
      </div>

      {schools.map(school => {
        const publicUrl = `${origin}/${orgSlug}/escola/${school.slug}/inscricao`
        const embedUrl = `${origin}/${orgSlug}/escola/${school.slug}/embed`
        const embedSnippet = `<iframe
  src="${embedUrl}"
  id="sisgo-form-${school.slug}"
  width="100%"
  height="600"
  style="border:none;display:block;"
  loading="lazy"
></iframe>
<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'sisgo-height') {
    document.getElementById('sisgo-form-${school.slug}').height = e.data.height;
  }
});
</script>`
        const isExpanded = expandedEmbed === school.slug
        const linkKey = `link-${school.slug}`
        const embedKey = `embed-${school.slug}`

        return (
          <div key={school.slug} className="space-y-2">
            {schools.length > 1 && (
              <p className="text-xs font-semibold text-indigo-700">{school.name}</p>
            )}

            <div className="flex items-center gap-2 bg-white border border-indigo-100 rounded-lg px-3 py-2">
              <input
                readOnly
                value={origin ? publicUrl : 'Carregando…'}
                className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate font-mono"
              />
              <button
                onClick={() => copyText(publicUrl, linkKey)}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {copied === linkKey ? <><Check className="size-3" /> Copiado!</> : <><Copy className="size-3" /> Copiar</>}
              </button>
              <a
                href={`/${orgSlug}/escola/${school.slug}/inscricao`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <ExternalLink className="size-3" />
              </a>
            </div>

            <button
              type="button"
              onClick={() => setExpandedEmbed(isExpanded ? null : school.slug)}
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
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    }`}
                  >
                    {copied === embedKey ? '✓ Copiado!' : 'Copiar'}
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
      })}
    </div>
  )
}
