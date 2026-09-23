'use client'

import { useRouter } from 'next/navigation'
import type { MouseEvent, ReactNode } from 'react'

/**
 * Linha de tabela que navega ao ser clicada. Cliques em elementos
 * interativos dentro da linha (link, botão, select, form de turma etc.)
 * não disparam a navegação — só propagam seu próprio comportamento.
 */
export function ClickableRow({
  href,
  children,
  className = '',
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  const router = useRouter()

  function handleClick(e: MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement
    if (target.closest('a, button, select, input, textarea, label')) return
    router.push(href)
  }

  return (
    <tr onClick={handleClick} className={`cursor-pointer hover:bg-gray-50 ${className}`}>
      {children}
    </tr>
  )
}
