'use client'

// Impede que clicar nos botões de ação dentro de um <summary> (Editar,
// Remover, + Andar/Quarto) também dispare o toggle do <details> pai —
// precisa ser Client Component porque Server Component não aceita handler
// de evento direto em elemento DOM puro.
export function StopClickPropagation({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 shrink-0" onClick={e => e.preventDefault()}>
      {children}
    </div>
  )
}
