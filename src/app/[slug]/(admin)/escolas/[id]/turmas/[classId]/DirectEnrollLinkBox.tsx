'use client'

import { useState, useEffect } from 'react'

export function DirectEnrollLinkBox({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState('')

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`)
  }, [path])

  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
      <input readOnly value={url}
        className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate" />
      <button type="button" onClick={copy}
        className="text-xs font-semibold text-brand-600 hover:text-brand-800 whitespace-nowrap flex-shrink-0">
        {copied ? '✓ Copiado!' : 'Copiar'}
      </button>
    </div>
  )
}
