/**
 * Lógica centralizada de papéis e permissões do SISGO.
 *
 * Todas as verificações de papel devem importar daqui — nunca repita
 * os arrays de strings inline nos componentes.
 *
 * Para adicionar um novo papel: (1) acrescente em `Role`, (2) ajuste os
 * grupos necessários abaixo, (3) adicione ao banco via migration.
 */

// ── Tipo union de todos os papéis do sistema ──────────────────────────────────

export type Role =
  | 'superadmin'
  | 'supervisor_bases'
  | 'admin_base'
  | 'lider_base'
  | 'dh'
  | 'secretaria'
  | 'hospitalidade'
  | 'cozinha'
  | 'manutencao'
  | 'lider_eted'
  | 'obreiro_eted'
  | 'lider_ministerio'
  | 'obreiro_ministerio'
  | 'aluno'
  | 'associado'

// ── Grupos de papéis ──────────────────────────────────────────────────────────

/** Papéis com visibilidade gerencial (vê todas as áreas da base) */
export const MANAGEMENT_ROLES: readonly Role[] = [
  'superadmin',
  'admin_base',
  'lider_base',
  'dh',
]

/**
 * Papéis com poder operacional de escrita (aprovar, criar, editar).
 * lider_base é excluído — ele VÊ tudo mas só edita configurações,
 * atribui líderes e gerencia o calendário da base.
 */
export const OPERATIONAL_ROLES: readonly Role[] = [
  'superadmin',
  'admin_base',
  'dh',
]

/** Papéis com acesso ao financeiro geral (lider_base vê mas não edita) */
export const GENERAL_FINANCE_ROLES: readonly Role[] = [
  'superadmin',
  'admin_base',
  'lider_base',
  'secretaria',
]

/** Papéis que podem ESCREVER no financeiro */
export const FINANCE_WRITE_ROLES: readonly Role[] = [
  'superadmin',
  'admin_base',
  'secretaria',
]

/** Papéis com acesso ao módulo de cozinha e estoque */
export const KITCHEN_ROLES: readonly Role[] = [
  'superadmin',
  'admin_base',
  'lider_base',
  'dh',
  'secretaria',
  'cozinha',
]

/** Papéis com acesso ao módulo de manutenção */
export const MANUTENCAO_ROLES: readonly Role[] = [
  'superadmin',
  'admin_base',
  'lider_base',
  'dh',
  'manutencao',
]

/** Papéis com acesso ao módulo de hospedagem (gestão de quartos) */
export const HOSPEDAGEM_ROLES: readonly Role[] = [
  'superadmin',
  'admin_base',
  'lider_base',
  'dh',
  'hospitalidade',
]

/** Papéis que podem ver o módulo de reservas */
export const RESERVATION_ROLES: readonly Role[] = [
  'superadmin',
  'admin_base',
  'lider_base',
  'dh',
  'hospitalidade',
  'lider_eted',
  'obreiro_eted',
  'aluno',
  'associado',
  'lider_ministerio',
  'obreiro_ministerio',
]

// ── Funções auxiliares ────────────────────────────────────────────────────────

/** Verifica se o papel tem acesso gerencial à base */
export function isManagementRole(role: string): boolean {
  return (MANAGEMENT_ROLES as readonly string[]).includes(role)
}

/** Papéis com poder de escrita operacional (exclui lider_base) */
export function isOperationalManager(role: string): boolean {
  return (OPERATIONAL_ROLES as readonly string[]).includes(role)
}

/** Verifica se o papel tem acesso ao financeiro geral */
export function isGeneralFinanceRole(role: string): boolean {
  return (GENERAL_FINANCE_ROLES as readonly string[]).includes(role)
}

/** Verifica se o papel pode ESCREVER no financeiro */
export function isFinanceWriter(role: string): boolean {
  return (FINANCE_WRITE_ROLES as readonly string[]).includes(role)
}

/** Verifica se o papel tem acesso à cozinha */
export function isKitchenRole(role: string): boolean {
  return (KITCHEN_ROLES as readonly string[]).includes(role)
}

/** Verifica se o papel tem acesso ao módulo de hospedagem */
export function canSeeHospedagem(role: string): boolean {
  return (HOSPEDAGEM_ROLES as readonly string[]).includes(role)
}

/** Verifica se o papel pode ver o módulo de reservas */
export function canSeeReservations(role: string): boolean {
  return (RESERVATION_ROLES as readonly string[]).includes(role)
}

/**
 * Verifica se ALGUMA das roles do usuário (primária + acumuladas) pertence
 * ao grupo de candidatos. Use no lugar das funções acima quando o usuário
 * pode ter funções acumuladas configuradas pelo líder da base.
 */
export function userHasAnyRole(userRoles: string[], candidates: readonly string[]): boolean {
  return userRoles.some(r => (candidates as string[]).includes(r))
}
