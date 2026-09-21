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
