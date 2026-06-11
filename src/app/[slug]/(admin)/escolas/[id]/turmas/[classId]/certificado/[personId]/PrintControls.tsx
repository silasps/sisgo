'use client'

import Link from 'next/link'

type Props = { backHref: string }

export function PrintControls({ backHref }: Props) {
  return (
    <div className="print:hidden mb-6 flex items-center gap-3 flex-wrap">
      <Link
        href={backHref}
        className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        ← Voltar
      </Link>
      <button
        onClick={() => window.print()}
        className="px-4 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors"
      >
        Imprimir / Salvar PDF
      </button>
      <p className="text-xs text-gray-400">Use Ctrl+P → "Salvar como PDF" para gerar o arquivo.</p>
    </div>
  )
}
