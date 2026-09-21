'use client'

import { useState, useTransition, useSyncExternalStore } from 'react'

type Action = () => void | Promise<void>

// Contador global de ações em andamento (soma de todas as instâncias deste
// hook no app inteiro) — módulo compartilhado, não React state, pra poder
// ser lido de qualquer lugar sem precisar de um Provider. Serve pra travar
// navegação enquanto algum save estiver de fato em andamento, se o app
// quiser adicionar esse guard depois (ver NavigationGuard do go_guide).
let globalPendingCount = 0
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify() {
  for (const listener of listeners) listener()
}

export function usePendingActionsCount() {
  return useSyncExternalStore(
    subscribe,
    () => globalPendingCount,
    () => 0 // servidor nunca tem ação pendente
  )
}

/**
 * Mantém um indicador de "pendente" ativo durante uma ação assíncrona.
 *
 * `isPending` cobre só a ação em si (ex.: a escrita no Supabase) — termina
 * assim que ela resolve, no mesmo instante em que o call site já dispara
 * seu toast de sucesso/erro. `router.refresh()`/`router.push()`, quando a
 * ação termina com um deles, continuam sendo chamados normalmente pelos
 * call sites: rodam por baixo dos panos, envoltos aqui num `startTransition`
 * só pra suavizar o repaint que o RSC dispara (evita o "salto" de UI
 * desatualizada reaparecendo por um instante), mas sem prender o spinner
 * a esse tempo — spinner e toast agora terminam juntos, sempre.
 *
 * T identifica QUAL ação está pendente (id do item, tipo de ação, etc.) —
 * útil em listas onde várias linhas podem disparar ações independentes.
 * `pendingValue` já vem gateado por `isPending` — nunca precisa ser limpo
 * manualmente (sem `finally { setX(null) }` espalhado pelo código).
 */
export function usePendingAction<T = true>() {
  const [value, setValue] = useState<T | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [, startTransition] = useTransition()

  async function run(next: T, action: Action) {
    setValue(next)
    setIsPending(true)
    globalPendingCount++
    notify()
    try {
      await new Promise<void>((resolve, reject) => {
        startTransition(() => {
          Promise.resolve(action()).then(resolve, reject)
        })
      })
    } finally {
      setIsPending(false)
      setValue(null)
      globalPendingCount--
      notify()
    }
  }

  return { pendingValue: isPending ? value : null, isPending, run }
}
