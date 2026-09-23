// Papéis/escopos de acesso de obreiro — compartilhado entre a aba "Acesso"
// da pessoa e o botão "+ Novo obreiro", pra não duplicar a lógica de
// papéis obrigatórios (líder/obreiro de escola sempre aparecem na lista,
// mesmo que ainda não exista nenhum registro criado no banco).

export type RoleRow = { id: string; name: string; label: string }
export type OptionRow = { id: string; name: string }

export const STAFF_ROLE_ORDER = ['pendente_alocacao', 'dh', 'secretaria', 'hospitalidade', 'cozinha', 'lider_eted', 'obreiro_eted', 'lider_ministerio', 'obreiro_ministerio']
export const BLOCKED_ROLE_NAMES = ['superadmin', 'admin_base', 'lider_base']
export const REQUIRED_STAFF_ROLES: Record<string, { label: string; description: string }> = {
  lider_eted: {
    label: 'Líder de Escola',
    description: 'Gestão da sua escola: alunos, inscrições, obreiros e turmas',
  },
  obreiro_eted: {
    label: 'Obreiro de Escola',
    description: 'Acesso restrito à escola onde serve',
  },
}

export function roleLabel(role: RoleRow) {
  return REQUIRED_STAFF_ROLES[role.name]?.label ?? role.label
}

function withRequiredStaffRoles(roles: RoleRow[]) {
  const byName = new Map(roles.map(role => [role.name, role]))
  for (const [name, config] of Object.entries(REQUIRED_STAFF_ROLES)) {
    if (!byName.has(name)) {
      byName.set(name, { id: `role:${name}`, name, label: config.label })
    }
  }
  return [...byName.values()]
}

function sortRoles(roles: RoleRow[]) {
  return roles.sort((a, b) => {
    const aIndex = STAFF_ROLE_ORDER.indexOf(a.name)
    const bIndex = STAFF_ROLE_ORDER.indexOf(b.name)
    if (aIndex === -1 && bIndex === -1) return roleLabel(a).localeCompare(roleLabel(b))
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })
}

type QueryClient = { from: (table: string) => ReturnType<import('@supabase/supabase-js').SupabaseClient['from']> }

export async function loadStaffRoles(supabase: QueryClient) {
  const { data: allRoles } = await supabase
    .from('roles')
    .select('id, name, label')
    .not('name', 'in', `("${BLOCKED_ROLE_NAMES.join('","')}")`)
    .order('name')

  return sortRoles(withRequiredStaffRoles(((allRoles ?? []) as RoleRow[]).filter(r => STAFF_ROLE_ORDER.includes(r.name))))
    .map(role => ({ ...role, label: roleLabel(role) }))
}

export async function loadStaffRoleOptions(supabase: QueryClient, orgId: string) {
  const [roles, { data: schoolsRaw }, { data: ministriesRaw }] = await Promise.all([
    loadStaffRoles(supabase),
    supabase
      .from('schools')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('ministries')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),
  ])

  return {
    roles,
    schools: (schoolsRaw ?? []) as OptionRow[],
    ministries: (ministriesRaw ?? []) as OptionRow[],
  }
}
