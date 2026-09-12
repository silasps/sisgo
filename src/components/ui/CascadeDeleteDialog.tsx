'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { useSidebarLeftClass } from '@/components/layout/account-context'

type Props = {
  itemLabel: string   // "bloco", "andar", "quarto" — usado nas frases
  itemName: string    // nome exibido e que precisa ser digitado pra confirmar
  details: string[]   // ex.: ["2 andares", "5 quartos", "12 camas cadastradas"] — vazio = sem nada embaixo na hierarquia
  onConfirm: () => void | Promise<void>
  children: React.ReactNode
}

// Mesma base do ConfirmDialog, mas quando há coisa embaixo na hierarquia
// (bloco com andar, andar com quarto, quarto com cama) exige digitar o nome
// pra confirmar — apagar aqui é cascata: some tudo junto, sem chance de
// desfazer. Sem nada embaixo, cai pro fluxo simples de sempre.
export function CascadeDeleteDialog({ itemLabel, itemName, details, onConfirm, children }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [typed, setTyped] = useState('')
  const sidebarLeftClass = useSidebarLeftClass()

  const hasChildren = details.length > 0
  const canConfirm = !hasChildren || typed.trim() === itemName

  function close() {
    if (loading) return
    setOpen(false)
    setTyped('')
  }

  async function handleConfirm() {
    if (!canConfirm) return
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
      setOpen(false)
      setTyped('')
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>

      {open && createPortal(
        <div
          className={`fixed inset-0 ${sidebarLeftClass} z-50 flex items-center justify-center bg-black/50 p-4`}
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-50">
                  <AlertTriangle size={20} className="text-red-500" />
                </div>
                <h2 className="font-semibold text-gray-900">
                  {hasChildren ? `Excluir ${itemLabel} e tudo dentro` : `Remover ${itemLabel}`}
                </h2>
              </div>

              {hasChildren ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {`O ${itemLabel} "${itemName}" ainda tem ${details.join(', ')}. Excluir vai apagar tudo isso junto — essa ação não pode ser desfeita.`}
                  </p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Digite <span className="font-semibold text-gray-900">{itemName}</span> para confirmar
                    </label>
                    <input
                      type="text"
                      value={typed}
                      onChange={e => setTyped(e.target.value)}
                      disabled={loading}
                      autoFocus
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      placeholder={itemName}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 leading-relaxed">
                  {`Remover o ${itemLabel} "${itemName}"? Esta ação não pode ser desfeita.`}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={close}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading || !canConfirm}
                  className="px-5 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 bg-red-500 hover:bg-red-600 text-white"
                >
                  {loading ? 'Aguarde…' : hasChildren ? 'Excluir tudo' : 'Remover'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
