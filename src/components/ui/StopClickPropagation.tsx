'use client'

// Impede que clicar nos botões de ação dentro de um <summary> (Editar,
// Remover, + Andar/Quarto) também dispare o toggle do <details> pai, ou que
// clicar neles dentro de um card <Link> (bloco/andar/quarto) também dispare
// a navegação do Link — precisa ser Client Component porque Server
// Component não aceita handler de evento direto em elemento DOM puro.
// stopPropagation (não só preventDefault) é necessário porque o Link do
// Next.js mostra a barra de progresso de navegação assim que o clique
// chega no próprio handler dele, antes mesmo de checar defaultPrevented —
// só preventDefault evitava a navegação, mas não a barra piscando.
export function StopClickPropagation({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 shrink-0"
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
    >
      {children}
    </div>
  )
}
