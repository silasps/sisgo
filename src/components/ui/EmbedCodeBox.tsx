'use client'

import { useState, useEffect } from 'react'

export function EmbedCodeBox({ embedPath }: { embedPath: string }) {
  const [copied, setCopied] = useState(false)
  const [embedUrl, setEmbedUrl] = useState('')

  useEffect(() => {
    setEmbedUrl(`${window.location.origin}${embedPath}`)
  }, [embedPath])

  const snippet = embedUrl
    ? `<iframe
  src="${embedUrl}"
  id="sisgo-form"
  width="100%"
  height="600"
  style="border:none;display:block;"
  loading="lazy"
></iframe>
<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'sisgo-height') {
    document.getElementById('sisgo-form').height = e.data.height;
  }
});
</script>`
    : ''

  function handleCopy() {
    if (!snippet) return
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white">
        <p className="text-xs font-semibold text-gray-600">Código de incorporação</p>
        <button
          onClick={handleCopy}
          className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
            copied
              ? 'bg-green-100 text-green-700'
              : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
          }`}
        >
          {copied ? '✓ Copiado!' : 'Copiar'}
        </button>
      </div>
      <pre className="p-4 text-xs text-gray-600 overflow-x-auto whitespace-pre font-mono leading-relaxed select-all">
        {snippet || 'Carregando…'}
      </pre>
      <div className="px-4 py-2.5 border-t border-gray-100 bg-white">
        <p className="text-xs text-gray-400">
          Cole este código no HTML do seu site onde deseja exibir o formulário.
          O iframe se redimensiona automaticamente.
        </p>
      </div>
    </div>
  )
}
