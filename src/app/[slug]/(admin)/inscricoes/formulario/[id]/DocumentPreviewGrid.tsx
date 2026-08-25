'use client'

import { useEffect, useState } from 'react'
import { FileText, ImageIcon, X } from 'lucide-react'

type DocEntry = { key: string; label: string; url: string | null; isImage: boolean }

export function DocumentPreviewGrid({ documents }: { documents: DocEntry[] }) {
  const [open, setOpen] = useState<DocEntry | null>(null)

  // Trava o scroll da página por trás enquanto o modal está aberto — sem
  // isso, uma imagem maior que a tela deixava a página "vazar" por baixo
  // do overlay ao rolar, parecendo bugado.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {documents.map(doc => (
          <button
            key={doc.key}
            type="button"
            onClick={() => doc.url && setOpen(doc)}
            disabled={!doc.url}
            className={`group rounded-lg border border-gray-200 overflow-hidden hover:border-indigo-300 transition-colors text-left ${!doc.url ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {doc.isImage && doc.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={doc.url} alt={doc.label} className="h-24 w-full object-cover bg-gray-50" />
            ) : (
              <div className="h-24 w-full flex items-center justify-center bg-gray-50">
                <FileText className="size-8 text-gray-400" />
              </div>
            )}
            <div className="px-2 py-1.5 flex items-center gap-1.5">
              {doc.isImage ? <ImageIcon className="size-3 shrink-0 text-gray-400" /> : <FileText className="size-3 shrink-0 text-gray-400" />}
              <p className="truncate text-xs font-medium text-gray-700 group-hover:text-indigo-700">{doc.label}</p>
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(null)}
        >
          <div className="max-w-3xl w-full flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 shrink-0">
              <p className="text-sm font-semibold text-white">{open.label}</p>
              <button type="button" onClick={() => setOpen(null)} className="text-white/80 hover:text-white">
                <X className="size-5" />
              </button>
            </div>
            {open.isImage && open.url ? (
              // Altura em vh direto na imagem, não em max-h-full: o pai é
              // flex com altura "auto" (só max-height), e porcentagem de
              // altura contra um pai "auto" é ignorada pelo navegador — a
              // imagem renderizava no tamanho natural, maior que a tela.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.url} alt={open.label} className="w-full max-h-[75vh] object-contain rounded-lg bg-white" />
            ) : open.url ? (
              <iframe src={open.url} title={open.label} className="w-full h-[75vh] rounded-lg bg-white" />
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
