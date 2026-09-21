'use client'

import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { useSidebarLeftClass } from '@/components/layout/account-context'

type Props = {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  loadingLabel?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: React.ReactNode
}

// Visual do modal de confirmação, sem opinião sobre como a ação em si é
// disparada — ConfirmDialog usa pra um callback direto, ConfirmSubmitButton
// pra submeter um <form action={...}> existente.
export function ConfirmModal({
  open,
  title = 'Confirmar ação',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loadingLabel = 'Aguarde…',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const sidebarLeftClass = useSidebarLeftClass()
  if (!open) return null

  const confirmBtnClass = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'bg-amber-500 hover:bg-amber-600 text-white'

  // Portal pro <body> — sem isso, um <div fixed> nascido dentro de um
  // ancestral com transform (ex.: card com hover:-translate-y-0.5) vira
  // "fixed" em relação a esse ancestral, não à viewport, e o modal aparece
  // preso perto do botão que abriu em vez de centralizado.
  return createPortal(
    <div
      className={`fixed inset-0 ${sidebarLeftClass} z-50 flex items-center justify-center bg-black/50 p-4`}
      onClick={e => {
        e.stopPropagation()
        if (e.target === e.currentTarget && !loading) onCancel()
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${variant === 'danger' ? 'bg-red-50' : 'bg-amber-50'}`}>
              <AlertTriangle size={20} className={variant === 'danger' ? 'text-red-500' : 'text-amber-500'} />
            </div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">{message}</p>

          {children}

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 ${confirmBtnClass}`}
            >
              {loading ? loadingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
