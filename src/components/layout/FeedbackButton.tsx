'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { saveFeedback } from '@/lib/feedback/saveFeedback'

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  pendentes: 'Pendentes',
  pessoas: 'Pessoas',
  escolas: 'Escolas',
  inscricoes: 'Inscrições',
  ministerios: 'Ministérios',
  reservas: 'Reservas',
  refeicoes: 'Refeições',
  caixa: 'Caixa',
  cozinha: 'Cozinha',
  financeiro: 'Financeiro',
  configuracoes: 'Configurações',
  formulario: 'Formulário',
}

function getLabel(path: string) {
  const parts = path.split('/').filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i--) {
    if (PAGE_LABELS[parts[i]]) return PAGE_LABELS[parts[i]]
  }
  return parts[parts.length - 1] ?? path
}

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const pathname = usePathname()
  const label = getLabel(pathname)

  async function handleSend() {
    if (!text.trim()) return
    setSaving(true)
    setErr('')
    try {
      const result = await saveFeedback(pathname, label, text)
      if (result && 'error' in result) {
        setErr(result.error ?? 'Erro desconhecido')
        setSaving(false)
        return
      }
      setDone(true)
      setTimeout(() => { setDone(false); setOpen(false); setText('') }, 2000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setText('')
    setDone(false)
    setErr('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Enviar sugestão"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-all duration-200 px-4 py-3 text-sm font-semibold group"
      >
        <span>💡</span>
        <span className="max-w-0 overflow-hidden group-hover:max-w-[5rem] transition-all duration-200 whitespace-nowrap text-xs">
          Sugestão
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Enviar sugestão</h3>
              <button
                onClick={handleClose}
                className="text-2xl text-gray-400 hover:text-gray-700 leading-none w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                ×
              </button>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <p className="text-xs text-indigo-500 font-medium mb-0.5">Você está em</p>
              <p className="text-sm text-indigo-900 font-semibold">{label}</p>
              <p className="text-xs text-indigo-400 truncate mt-0.5">{pathname}</p>
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Descreva sua sugestão ou problema encontrado nesta área…"
              rows={4}
              disabled={done}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 resize-none disabled:opacity-50"
            />

            {err && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>
            )}
            <button
              onClick={handleSend}
              disabled={saving || done || !text.trim()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {done ? '✓ Sugestão enviada!' : saving ? 'Enviando…' : 'Enviar sugestão'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
