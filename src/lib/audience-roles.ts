/** Papéis selecionáveis como audiência de anúncios/eventos de base. Nenhum marcado = todos. */
export const AUDIENCE_ROLES: Array<{ value: string; label: string }> = [
  { value: 'aluno', label: 'Aluno' },
  { value: 'associado', label: 'Associado' },
  { value: 'obreiro', label: 'Obreiro' },
  { value: 'lider', label: 'Líder' },
  { value: 'hospitalidade', label: 'Hospitalidade' },
  { value: 'secretaria', label: 'Secretaria' },
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'dh', label: 'DH' },
]

// Escola ou ministério não fazem diferença pra quem publica um anúncio/
// evento de base — obreiro é obreiro, líder é líder, em qualquer situação
// (decisão do usuário; ETED também é terminologia interna de uma instituição
// específica, não deveria aparecer numa lista genérica de audiência do SaaS).
// Esses 4 papéis principais colapsam nos 2 grupos genéricos acima.
const AUDIENCE_GROUP: Record<string, string> = {
  obreiro_eted: 'obreiro',
  obreiro_ministerio: 'obreiro',
  lider_eted: 'lider',
  lider_ministerio: 'lider',
}

/**
 * `viewerRole` é sempre um papel principal de verdade (ex. `obreiro_eted`);
 * `selectedRoles` é o que foi marcado no formulário (ex. `['obreiro']`, ou
 * um anúncio antigo que ainda tenha o valor granular salvo — `includes`
 * direto continua batendo nesse caso, sem precisar migrar dado nenhum).
 * Nenhum papel marcado = visível pra todos.
 */
export function matchesAudience(viewerRole: string, selectedRoles: string[] | null | undefined): boolean {
  if (!selectedRoles || selectedRoles.length === 0) return true
  const group = AUDIENCE_GROUP[viewerRole] ?? viewerRole
  return selectedRoles.includes(viewerRole) || selectedRoles.includes(group)
}
