'use client'

import { useEffect, useRef, useState } from 'react'
import { Link2, Code } from 'lucide-react'
import { toast } from 'sonner'

export type PublicLinkEntry = {
  key: string
  label: string
  /** caminho relativo (sem origin) do formulário público */
  path: string
  /** caminho relativo (sem origin) do endpoint de embed/iframe */
  embedPath: string
  /** 'form' = escola/ministério específico (com div#inscricao + resize); 'servir' = página geral de obreiros */
  embedKind: 'form' | 'servir'
}

const ACCENT = {
  indigo: 'text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50',
  violet: 'text-violet-500 hover:text-violet-700 hover:bg-violet-50',
} as const

function buildEmbedSnippet(entry: PublicLinkEntry, embedUrl: string) {
  if (entry.embedKind === 'servir') {
    return `<iframe
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
  }
  return `<style>html{scroll-behavior:smooth}</style>
<div id="inscricao" style="min-width:320px;max-width:900px;margin:0 auto;width:100%">
  <iframe
    src="${embedUrl}"
    id="sisgo-form-${entry.key}"
    width="100%"
    height="600"
    style="border:none;display:block;min-width:320px;"
    loading="lazy"
  ></iframe>
</div>
<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'sisgo-height') {
    var el = document.getElementById('sisgo-form-${entry.key}');
    if (el) el.style.height = e.data.height + 'px';
  }
});
</script>`
}

export function PublicLinkButtons({ entries, accent = 'indigo' }: { entries: PublicLinkEntry[]; accent?: keyof typeof ACCENT }) {
  const [openMenu, setOpenMenu] = useState<'link' | 'embed' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openMenu) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [openMenu])

  if (entries.length === 0) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  async function copy(text: string, successMsg: string) {
    await navigator.clipboard.writeText(text).catch(() => {})
    toast.success(successMsg)
    setOpenMenu(null)
  }

  function copyLink(entry: PublicLinkEntry) {
    copy(`${origin}${entry.path}`, entries.length > 1 ? `Link de ${entry.label} copiado!` : 'Link copiado!')
  }

  function copyEmbed(entry: PublicLinkEntry) {
    copy(buildEmbedSnippet(entry, `${origin}${entry.embedPath}`), entries.length > 1 ? `Código de ${entry.label} copiado!` : 'Código de incorporação copiado!')
  }

  function handleClick(kind: 'link' | 'embed') {
    if (entries.length === 1) {
      if (kind === 'link') copyLink(entries[0])
      else copyEmbed(entries[0])
    } else {
      setOpenMenu(m => (m === kind ? null : kind))
    }
  }

  const colorClass = ACCENT[accent]

  return (
    <div ref={ref} className="flex items-center gap-0.5">
      <div className="relative">
        <button type="button" onClick={() => handleClick('link')} title="Copiar link de pré-inscrição"
          className={`p-2 rounded-lg transition-colors ${colorClass}`}>
          <Link2 className="size-4" />
        </button>
        {openMenu === 'link' && (
          <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1 z-10">
            {entries.map(entry => (
              <button key={entry.key} type="button" onClick={() => copyLink(entry)}
                className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 truncate">
                {entry.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <button type="button" onClick={() => handleClick('embed')} title="Copiar código de incorporação"
          className={`p-2 rounded-lg transition-colors ${colorClass}`}>
          <Code className="size-4" />
        </button>
        {openMenu === 'embed' && (
          <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1 z-10">
            {entries.map(entry => (
              <button key={entry.key} type="button" onClick={() => copyEmbed(entry)}
                className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 truncate">
                {entry.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
