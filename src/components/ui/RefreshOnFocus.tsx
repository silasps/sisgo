'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Refaz o fetch dos dados do server component (router.refresh) quando a aba
// volta a ficar visível — cobre o caso comum de ficar com a tela aberta
// enquanto outra pessoa (ex.: o pastor de referência) preenche algo em outro
// lugar, sem precisar de polling constante nem realtime.
export function RefreshOnFocus() {
  const router = useRouter()

  useEffect(() => {
    function onFocus() {
      if (document.visibilityState === 'visible') router.refresh()
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [router])

  return null
}
