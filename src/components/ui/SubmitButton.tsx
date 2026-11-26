'use client'

import { isValidElement, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

// Estado de carregamento pro botão de um <form action={serverAction}> —
// sem isso, o único feedback visual de "está processando" era o formulário
// sumir (quando o modal fecha no onSubmit) e a tela ficar parada até o
// redirect do server action terminar, o que parece travamento. Padrão do
// sistema pra TODO botão de salvar/aplicar/enviar (ver CLAUDE.md).
//
// Enquanto a action roda, todos os botões de envio do form ficam
// desabilitados (não manda duas decisões) e só o que foi clicado troca o
// texto — descoberto pelo `submitter` do evento submit, então vale também
// pra Aceitar/Recusar com formAction diferente, sem precisar de name/value.
// Sem `pendingText`, o texto sai do rótulo: "Salvar" → "Salvando…",
// "Excluir" → "Excluindo…"; botão só de ícone vira só o spinner.

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

/** "Salvar alterações" → "Salvando…"; null quando o rótulo não começa com verbo no infinitivo. */
export function gerundLabel(children: React.ReactNode): string | null {
  const word = textOf(children).replace(/^[^\p{L}]+/u, '').split(/\s+/)[0] ?? ''
  const m = word.match(/^(\p{L}+?)(ar|er|ir)$/iu)
  if (!m || word.length < 3) return null
  const ending = { ar: 'ando', er: 'endo', ir: 'indo' }[m[2].toLowerCase() as 'ar' | 'er' | 'ir']
  return `${m[1]}${ending}…`
}

export function SubmitButton({
  children,
  pendingText,
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
  const ref = useRef<HTMLButtonElement>(null)
  const [mine, setMine] = useState(false)

  useEffect(() => {
    const form = ref.current?.form
    if (!form) return
    const onSubmit = (e: Event) => {
      const submitter = (e as SubmitEvent).submitter
      // Sem submitter (form.requestSubmit() sem botão): o 1º botão de envio representa o form.
      setMine(submitter ? submitter === ref.current : form.querySelector('button[type="submit"]') === ref.current)
    }
    form.addEventListener('submit', onSubmit)
    return () => form.removeEventListener('submit', onSubmit)
  }, [])

  useEffect(() => {
    if (!pending) setMine(false)
  }, [pending])

  const isMine = pending && mine
  const label = pendingText ?? (textOf(children).trim() ? (gerundLabel(children) ?? 'Processando…') : null)

  return (
    <button ref={ref} type="submit" disabled={disabled || pending} aria-busy={isMine || undefined} className={className} {...rest}>
      {isMine ? (
        <span className="inline-flex items-center justify-center gap-1.5">
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
          {label}
        </span>
      ) : children}
    </button>
  )
}
