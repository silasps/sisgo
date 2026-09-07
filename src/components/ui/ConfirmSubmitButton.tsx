'use client'

type Props = {
  confirmMessage: string
  className?: string
  children: React.ReactNode
}

// Botão de submit que pede confirmação nativa antes de mandar o form —
// pra ação destrutiva (cancelar, excluir) dentro de um form de Server
// Component simples, sem precisar virar um modal próprio.
export function ConfirmSubmitButton({ confirmMessage, className, children }: Props) {
  return (
    <button
      type="submit"
      className={className}
      onClick={e => { if (!window.confirm(confirmMessage)) e.preventDefault() }}
    >
      {children}
    </button>
  )
}
