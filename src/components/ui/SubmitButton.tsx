'use client'

import { useFormStatus } from 'react-dom'

// Estado de carregamento pro botão de um <form action={serverAction}> —
// sem isso, o único feedback visual de "está processando" era o formulário
// sumir (quando o modal fecha no onSubmit) e a tela ficar parada até o
// redirect do server action terminar, o que parece travamento.
export function SubmitButton({
  children,
  pendingText = 'Salvando…',
  className = 'w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors',
  disabled = false,
  ...rest
}: {
  children: React.ReactNode
  pendingText?: string
  className?: string
  disabled?: boolean
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'className' | 'disabled' | 'children'>) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={disabled || pending} className={className} {...rest}>
      {pending ? pendingText : children}
    </button>
  )
}
