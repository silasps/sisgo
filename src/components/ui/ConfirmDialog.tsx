'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from './ConfirmModal'

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
    } catch (e) {
      // redirect() do Next lança um erro especial (digest "NEXT_REDIRECT")
      // pra ser tratado pelo RedirectBoundary — não é uma falha de verdade,
      // é assim que o redirect de sucesso da Server Action se propaga aqui.
      if (e && typeof e === 'object' && 'digest' in e && String(e.digest).startsWith('NEXT_REDIRECT')) {
        throw e
      }
      toast.error(e instanceof Error ? e.message : 'Não foi possível concluir a ação.')
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>
      <ConfirmModal
        open={open}
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        variant={variant}
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
