'use client'

import { useEffect } from 'react'

// Trava o scroll do body enquanto um modal em tela cheia está aberto. Só
// `overflow: hidden` não basta no iOS Safari: se a página já estava rolada
// no momento de travar, o navegador "perde a conta" de onde o viewport
// visível de verdade está, e qualquer `position: fixed` dentro do modal
// pode aparecer deslocado pela distância que já tinha sido rolada — com o
// scroll travado, não dá pra corrigir rolando. A técnica que resolve de
// verdade (usada em apps grandes tipo Instagram/Twitter pra esse exato
// problema): fixar o próprio body na posição atual do scroll (position:
// fixed + top negativo) em vez de só bloquear o overflow, e devolver a
// posição ao desmontar.
export function useBodyScrollLock() {
  useEffect(() => {
    const scrollY = window.scrollY
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    }

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'

    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.left = prev.left
      body.style.right = prev.right
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [])
}
