'use client'

import { usePathname } from 'next/navigation'

// Mobile: uma tela por vez (lista OU conversa, trocando de tela de
// verdade). Desktop (`lg:`, mesmo breakpoint de ministerios/[id]/page.tsx —
// `md:` já é comido pelo sidebar fixo, sobra pouco espaço num split de 3
// colunas em tablet): lista + conversa lado a lado sempre.
export function ChatShell({ chatBasePath, list, children }: {
  chatBasePath: string
  list: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isThreadRoute = pathname !== chatBasePath

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <div className={`${isThreadRoute ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 lg:shrink-0 lg:border-r border-gray-200 flex-col min-h-0`}>
        {list}
      </div>
      <div className={`${isThreadRoute ? 'flex' : 'hidden lg:flex'} flex-1 flex-col min-h-0`}>
        {children}
      </div>
    </div>
  )
}
