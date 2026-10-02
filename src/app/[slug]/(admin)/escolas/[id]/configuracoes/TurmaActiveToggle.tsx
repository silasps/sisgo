'use client'

import { useState, useTransition, type MouseEvent } from 'react'
import { toggleTurmaActive } from '../actions'
import { triggerSiteRevalidation } from '@/lib/revalidate-webhook'

// Alterna ativo/inativo sem recarregar a página — antes isso era um
// <form action={server action}> terminando em redirect(), e como essa
// página faz muitas queries, a volta levava vários segundos e parecia
// travamento. Aqui o estado muda na hora (otimista) e só reverte se o
// servidor falhar.
export function TurmaActiveToggle({ classId, active, organizationId }: {
  classId: string
  active: boolean
  organizationId: string
}) {
  const [isActive, setIsActive] = useState(active)
  const [isPending, startTransition] = useTransition()

  function handleClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const wasActive = isActive
    setIsActive(!wasActive)
    startTransition(async () => {
      try {
        await toggleTurmaActive(classId, wasActive)
        triggerSiteRevalidation(organizationId, 'events')
      } catch {
        setIsActive(wasActive)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={isActive ? 'Desativar turma' : 'Ativar turma'}
      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
    >
      {isActive ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      )}
    </button>
  )
}
