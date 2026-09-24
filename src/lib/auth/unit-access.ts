import { createAdminClient } from '@/lib/supabase/admin'
import type { RolePreview } from '@/lib/role-preview'
import { isManagementRole } from '@/lib/auth/permissions'

/**
 * Acesso a uma escola/ministério pelo VÍNCULO da pessoa com a unidade, não
 * pelo papel principal. Quem é "obreiro_ministerio" e também lidera a escola
 * DTS (school_leaders) entra na DTS como líder; quem é "lider_ministerio" do
 * Louvor e membro da Intercessão entra na Intercessão só como membro.
 *
 * Gestão (isManagementRole) continua entrando em qualquer unidade — isso fica
 * a cargo de quem chama; aqui só se resolvem os vínculos diretos.
 *
 * Toda tela dentro de /escolas/[id] e /ministerios/[id] deve decidir poderes
 * (líder x obreiro/membro) a partir daqui, nunca de `role === 'lider_eted'`
 * etc. — senão o líder de um ministério ganha poderes de líder no ministério
 * em que é só membro.
 */

export type SchoolLink = 'lider' | 'obreiro'
export type MinistryLink = 'lider' | 'membro'

export type LinkedSchool = { id: string; name: string; link: SchoolLink }
export type LinkedMinistry = { id: string; name: string; longName: string | null; link: MinistryLink }

export type UnitAccessContext = {
  userId: string
  orgId: string
  /** Papel efetivo (já com preview aplicado), como devolvido por getCurrentOrganizationRole. */
  role: string
  preview: RolePreview | null
}

type Admin = ReturnType<typeof createAdminClient>

// Superadmin simulando um papel preso a uma unidade (cookie de escola/
// ministério): só aquela unidade vale, com o nível do papel simulado — os
// vínculos reais do próprio superadmin são ignorados pra simulação ser fiel.
const PREVIEW_SCHOOL_LINK: Record<string, SchoolLink> = { lider_eted: 'lider', obreiro_eted: 'obreiro' }
const PREVIEW_MINISTRY_LINK: Record<string, MinistryLink> = { lider_ministerio: 'lider', obreiro_ministerio: 'membro' }
const previewPinsUnit = (preview: RolePreview | null) => !!(preview?.schoolId || preview?.ministryId)

// Lista, não maybeSingle(): há usuários com staff_profiles duplicados na mesma
// base (cadastros importados/refeitos) — com maybeSingle() a consulta falha e
// os vínculos de membro/obreiro somem. Registros nunca são apagados, então
// considera todos os perfis da pessoa.
async function staffPersonIds(db: Admin, orgId: string, userId: string): Promise<string[]> {
  const { data } = await db
    .from('staff_profiles')
    .select('person_id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
  return [...new Set((data ?? []).map(r => r.person_id).filter((id): id is string => !!id))]
}

const leadersFirstThenName = <T extends { name: string; link: string }>(a: T, b: T) =>
  Number(a.link !== 'lider') - Number(b.link !== 'lider') || a.name.localeCompare(b.name, 'pt-BR')

/** Escolas que a pessoa lidera (school_leaders) ou em que serve (school_staff ativo). */
export async function getMySchools(ctx: UnitAccessContext): Promise<LinkedSchool[]> {
  const db = createAdminClient()

  if (previewPinsUnit(ctx.preview)) {
    const link = PREVIEW_SCHOOL_LINK[ctx.role]
    if (!ctx.preview?.schoolId || !link) return []
    const { data } = await db.from('schools').select('id, name')
      .eq('id', ctx.preview.schoolId).eq('organization_id', ctx.orgId).maybeSingle()
    return data ? [{ id: data.id, name: data.name, link }] : []
  }

  const personIds = await staffPersonIds(db, ctx.orgId, ctx.userId)
  type Row = { school_id: string; schools: { name: string; organization_id: string } | null }
  const [{ data: leaderRows }, { data: staffRows }, { data: createdRows }] = await Promise.all([
    db.from('school_leaders')
      .select('school_id, schools(name, organization_id)')
      .eq('organization_id', ctx.orgId)
      .eq('user_id', ctx.userId),
    personIds.length > 0
      ? db.from('school_staff')
        .select('school_id, schools(name, organization_id)')
        .in('person_id', personIds)
        .eq('active', true)
      : Promise.resolve({ data: [] }),
    // Criador da escola (ver escolas/nova/page.tsx, migration 138) tem
    // acesso equivalente a líder — mas não é um vínculo em school_leaders:
    // não aparece em "Liderança da Escola" nem conta pro alerta de "sem
    // líder". É só pra quem criou continuar conseguindo achar/editar a
    // escola sem precisar de um papel de gestão.
    db.from('schools').select('id, name, organization_id')
      .eq('organization_id', ctx.orgId).eq('created_by', ctx.userId),
  ])

  const schools = new Map<string, LinkedSchool>()
  const add = (rows: unknown[] | null, link: SchoolLink) => {
    for (const row of (rows ?? []) as Row[]) {
      if (!row.schools || row.schools.organization_id !== ctx.orgId || schools.has(row.school_id)) continue
      schools.set(row.school_id, { id: row.school_id, name: row.schools.name, link })
    }
  }
  add(leaderRows, 'lider') // liderança primeiro: líder e obreiro ao mesmo tempo vale "líder"
  for (const row of (createdRows ?? []) as Array<{ id: string; name: string; organization_id: string }>) {
    if (row.organization_id !== ctx.orgId || schools.has(row.id)) continue
    schools.set(row.id, { id: row.id, name: row.name, link: 'lider' })
  }
  add(staffRows, 'obreiro')
  return [...schools.values()].sort(leadersFirstThenName)
}

/** Ministérios que a pessoa lidera (ministry_leaders) ou de que é membro ativo (ministry_members). */
export async function getMyMinistries(ctx: UnitAccessContext): Promise<LinkedMinistry[]> {
  const db = createAdminClient()

  if (previewPinsUnit(ctx.preview)) {
    const link = PREVIEW_MINISTRY_LINK[ctx.role]
    if (!ctx.preview?.ministryId || !link) return []
    const { data } = await db.from('ministries').select('id, name, long_name')
      .eq('id', ctx.preview.ministryId).eq('organization_id', ctx.orgId).maybeSingle()
    return data ? [{ id: data.id, name: data.name, longName: data.long_name, link }] : []
  }

  const personIds = await staffPersonIds(db, ctx.orgId, ctx.userId)
  type Row = { ministry_id: string; ministries: { name: string; long_name: string | null; organization_id: string } | null }
  const [{ data: leaderRows }, { data: memberRows }] = await Promise.all([
    db.from('ministry_leaders')
      .select('ministry_id, ministries(name, long_name, organization_id)')
      .eq('organization_id', ctx.orgId)
      .eq('user_id', ctx.userId),
    personIds.length > 0
      ? db.from('ministry_members')
        .select('ministry_id, ministries(name, long_name, organization_id)')
        .in('person_id', personIds)
        .eq('active', true)
      : Promise.resolve({ data: [] }),
  ])

  const ministries = new Map<string, LinkedMinistry>()
  const add = (rows: unknown[] | null, link: MinistryLink) => {
    for (const row of (rows ?? []) as Row[]) {
      const m = row.ministries
      if (!m || m.organization_id !== ctx.orgId || ministries.has(row.ministry_id)) continue
      ministries.set(row.ministry_id, { id: row.ministry_id, name: m.name, longName: m.long_name, link })
    }
  }
  add(leaderRows, 'lider')
  add(memberRows, 'membro')
  return [...ministries.values()].sort(leadersFirstThenName)
}

export async function getSchoolLink(ctx: UnitAccessContext, schoolId: string): Promise<SchoolLink | null> {
  return (await getMySchools(ctx)).find(s => s.id === schoolId)?.link ?? null
}

export async function getMinistryLink(ctx: UnitAccessContext, ministryId: string): Promise<MinistryLink | null> {
  return (await getMyMinistries(ctx)).find(m => m.id === ministryId)?.link ?? null
}

/**
 * Telas de revisão de inscrição (formulario/formulario-obreiro) usavam
 * `role === 'lider_eted'`/`'lider_ministerio'` pra liberar acesso, sem checar
 * a QUAL escola/ministério a inscrição pertence — isso ao mesmo tempo (a)
 * bloqueava quem lidera a unidade certa mas cujo papel principal é outro
 * (ex.: obreiro_ministerio que também lidera uma escola via school_leaders,
 * ver comentário no topo do arquivo) e (b) vazava inscrições de QUALQUER
 * escola/ministério pra qualquer lider_eted/lider_ministerio da base. Use
 * estas funções em vez de checar o papel principal diretamente.
 */
export async function canAccessSchool(ctx: UnitAccessContext, schoolId: string | null): Promise<boolean> {
  if (isManagementRole(ctx.role)) return true
  if (!schoolId) return false
  return (await getSchoolLink(ctx, schoolId)) !== null
}

/** Igual a canAccessSchool, mas só libera quem lidera a escola (não obreiro/membro). */
export async function canLeadSchool(ctx: UnitAccessContext, schoolId: string | null): Promise<boolean> {
  if (isManagementRole(ctx.role)) return true
  if (!schoolId) return false
  return (await getSchoolLink(ctx, schoolId)) === 'lider'
}

/** Igual a canLeadSchool, mas pra ministério. */
export async function canLeadMinistry(ctx: UnitAccessContext, ministryId: string | null): Promise<boolean> {
  if (isManagementRole(ctx.role)) return true
  if (!ministryId) return false
  return (await getMinistryLink(ctx, ministryId)) === 'lider'
}

/**
 * Candidatura de obreiro (staff_applications/staff_interest_forms) — destino
 * é escola OU ministério (mutuamente exclusivo, migration 089) OU nenhum
 * ainda (fica visível a quem lidera algum ministério, pra escolher destino).
 */
export async function canReviewStaffApplication(
  ctx: UnitAccessContext,
  schoolId: string | null,
  ministryId: string | null,
): Promise<boolean> {
  if (isManagementRole(ctx.role)) return true
  if (schoolId) return (await getSchoolLink(ctx, schoolId)) === 'lider'
  if (ministryId) return (await getMinistryLink(ctx, ministryId)) === 'lider'
  return (await getMyMinistries(ctx)).some(m => m.link === 'lider')
}
