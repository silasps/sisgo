'use client'

import { useEffect, useState } from 'react'
import { Download, FileText, ImageIcon, X } from 'lucide-react'

type DocEntry = { key: string; label: string; url: string | null; isImage: boolean; fileName: string | null }

export function DocumentPreviewGrid({ documents }: { documents: DocEntry[] }) {
  const [open, setOpen] = useState<DocEntry | null>(null)
  const [downloading, setDownloading] = useState(false)

  // Trava o scroll da página por trás enquanto o modal está aberto — sem
  // isso, uma imagem maior que a tela deixava a página "vazar" por baixo
  // do overlay ao rolar, parecendo bugado.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  async function handleDownload() {
    if (!open?.url) return
    setDownloading(true)
    try {
      // Baixa via blob em vez de <a href download> direto: o arquivo vem
      // de outra origem (Storage assinado), e navegadores costumam ignorar
      // o atributo download em link cross-origin (abre em nova aba em vez
      // de salvar). Um blob: é sempre same-origin, então o download sempre
      // funciona com o nome de arquivo certo.
      const res = await fetch(open.url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = open.fileName || open.label
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      // silencioso — pior caso, a pessoa tenta de novo
    } finally {
      setDownloading(false)
    }
  }

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
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{open.label}</p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-60"
                >
                  <Download className="size-3.5" />
                  {downloading ? 'Baixando…' : 'Baixar'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto bg-gray-50 flex items-center justify-center p-4">
              {open.isImage && open.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.url} alt={open.label} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
              ) : open.url ? (
                <iframe src={open.url} title={open.label} className="w-full h-[70vh] rounded-lg bg-white" />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
