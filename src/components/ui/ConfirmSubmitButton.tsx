'use client'

import { useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ConfirmModal } from './ConfirmModal'

type Props = {
  confirmMessage: string
  className?: string
  title?: string
  children: React.ReactNode
}

// Botão de submit que pede confirmação num modal antes de mandar o form —
// pra ação destrutiva (cancelar, excluir) dentro de um form de Server
// Component simples. type="button" pra não submeter direto: o submit real
// só acontece via requestSubmit() depois de confirmar no modal.
export function ConfirmSubmitButton({ confirmMessage, className, title, children }: Props) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // useFormStatus só enxerga o <form> ancestral — dá o "pending" real da
  // Server Action, não um estado local que a gente teria que zerar na mão
  // (a navegação do redirect() no fim da action desmonta tudo de qualquer
  // forma). Mantém o modal aberto em "Cancelando…" até isso acontecer, em
  // vez de fechar na hora e deixar o botão parado sem feedback nenhum.
  const { pending } = useFormStatus()

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        title={title}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <ConfirmModal
        open={open}
        message={confirmMessage}
        loadingLabel="Cancelando…"
        loading={pending}
        onConfirm={() => buttonRef.current?.form?.requestSubmit()}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
