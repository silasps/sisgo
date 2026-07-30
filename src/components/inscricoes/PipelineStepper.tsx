export type Stage = { label: string; status: 'done' | 'current' | 'pending' }

// flags[i] = etapa i já está concluída. Assume ordem monotônica (uma etapa
// só é considerada concluída se todas as anteriores também estão).
export function stagesFromFlags(labels: string[], flags: boolean[]): Stage[] {
  const firstPending = flags.findIndex(f => !f)
  return labels.map((label, i) => {
    if (firstPending === -1 || i < firstPending) return { label, status: 'done' as const }
    if (i === firstPending) return { label, status: 'current' as const }
    return { label, status: 'pending' as const }
  })
}

export function PipelineStepper({ stages, href, size = 'sm' }: { stages: Stage[]; href?: string; size?: 'sm' | 'md' }) {
  const total = stages.length
  const doneCount = stages.filter(s => s.status === 'done').length
  const currentIndex = stages.findIndex(s => s.status === 'current')
  const current = currentIndex === -1 ? undefined : stages[currentIndex]
  const textClass = size === 'md' ? 'text-sm font-medium text-gray-700' : 'text-xs text-gray-500'
  const dotClass = size === 'md' ? 'h-2 w-5' : 'h-1.5 w-4'
  // A última etapa costuma ser um rótulo de estado concluído (ex. "Aprovado")
  // — quando ela é a "atual" (ainda não alcançada), dizer só o nome dela dá a
  // entender que já aconteceu. "Aguardando X" deixa claro que é o próximo
  // passo, não um fato consumado.
  const isLastPending = currentIndex === total - 1

  const content = (
    <div className={`flex items-center gap-2 ${textClass}`}>
      <div className="flex gap-0.5 shrink-0">
        {stages.map((s, i) => (
          <span
            key={i}
            title={s.label}
            className={`${dotClass} rounded-full ${
              s.status === 'done' ? 'bg-green-500' : s.status === 'current' ? 'bg-indigo-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <span className="whitespace-nowrap">
        {!current
          ? `${doneCount}/${total} etapas concluídas`
          : isLastPending
          ? `${doneCount}/${total} etapas concluídas · falta: ${current.label}`
          : `Etapa ${doneCount + 1} de ${total} · ${current.label}`}
      </span>
    </div>
  )

  if (!href) return content
  return (
    <a
      href={href}
      onClick={e => e.stopPropagation()}
      className="group inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
      title="Ver e gerenciar esta etapa"
    >
      {content}
      <span className="text-indigo-600 text-xs font-semibold underline-offset-2 group-hover:underline whitespace-nowrap">
        Detalhes →
      </span>
    </a>
  )
}
