'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void | Promise<void>
  children: React.ReactNode
}

export function ConfirmDialog({
  title = 'Confirmar ação',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  children,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  const confirmBtnClass = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'bg-amber-500 hover:bg-amber-600 text-white'

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>

      {open && (
        <div
          className="fixed inset-0 md:left-60 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => { if (e.target === e.currentTarget && !loading) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${variant === 'danger' ? 'bg-red-50' : 'bg-amber-50'}`}>
                  <AlertTriangle
                    size={20}
                    className={variant === 'danger' ? 'text-red-500' : 'text-amber-500'}
                  />
                </div>
                <h2 className="font-semibold text-gray-900">{title}</h2>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed">{message}</p>

              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading}
                  className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 ${confirmBtnClass}`}
                >
                  {loading ? 'Aguarde…' : confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
