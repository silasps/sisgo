'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'

// Cabeçalho da página fica sempre fixo no topo (independente da altura, que
// varia com o stepper/avisos condicionais) e publica sua altura real via
// contexto — os títulos de cada SectionCard usam isso pra saber exatamente
// onde parar de rolar e se prender logo abaixo dele, sem se sobrepor.
const HeaderHeightCtx = createContext(0)

export function useStickyHeaderHeight() {
  return useContext(HeaderHeightCtx)
}

export function StickyPageHeader({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setHeight(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // O Provider precisa envolver tanto o header quanto o conteúdo abaixo —
  // é o conteúdo (os títulos de seção) que consome a altura medida aqui.
  return (
    <HeaderHeightCtx.Provider value={height}>
      <div ref={ref} className="sticky top-0 z-10">
        {header}
      </div>
      {children}
    </HeaderHeightCtx.Provider>
  )
}
