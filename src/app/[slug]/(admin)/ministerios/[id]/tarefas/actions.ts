'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRolePreview, type RolePreview } from '@/lib/role-preview'
import { isManagementRole } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'

// Usa createAdminClient() (ignora RLS) + checagem de permissão aqui, igual
// comunicacao/actions.ts — nunca confiar em RLS puro pra essa mutação.
// Motivo: RLS só enxerga o auth.uid() real, sem nenhuma noção do preview
// ("Visualizar como") — gestão/superadmin testando como líder de um
// ministério específico caía em "new row violates row-level security
// policy" mesmo tendo acesso de verdade pela aplicação. As policies
// continuam no banco como camada extra de defesa (RLS da migration 141),
// só não são mais a fonte da verdade de autorização.
type Ctx = { supabase: Awaited<ReturnType<typeof createClient>>; userId: string }

async function requireUser(): Promise<Ctx> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')
  return { supabase, userId: user.id }
}

// Versão enxuta de getCurrentOrganizationRole (org-role.ts) — só o papel
// efetivo + preview, sem role_accumulations/extra_roles/linkedRoles (que
// essa checagem não usa). Cada consulta extra é mais um round-trip até o
// Supabase hospedado — a versão completa deixava criar/excluir coluna
// levando ~12s.
async function resolveRole(ctx: Ctx, orgId: string) {
  const { data: orgUsers } = await ctx.supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', ctx.userId)
    .eq('active', true)
  const rows = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | { name: string }[] | null }>
  const roleName = (row?: (typeof rows)[number]) => {
    const r = row?.roles
    return Array.isArray(r) ? (r[0]?.name ?? '') : (r?.name ?? '')
  }
  const superadminRow = rows.find(r => roleName(r) === 'superadmin')
  const currentOrgRow = rows.find(r => r.organization_id === orgId)
  const realRole = roleName(superadminRow) || roleName(currentOrgRow)
  const preview = await getRolePreview(realRole)
  return { role: preview?.role ?? realRole, preview }
}

// Quadro é de um ministério OU de uma escola (migration 156). As linhas
// guardam isso em ministry_id/school_id; aqui vira uma "unidade".
export type BoardUnit = { kind: 'ministerio' | 'escola'; id: string }

function unitOf(row: { ministry_id: string | null; school_id: string | null }): BoardUnit {
  return row.ministry_id ? { kind: 'ministerio', id: row.ministry_id } : { kind: 'escola', id: row.school_id as string }
}

function unitColumns(unit: BoardUnit) {
  return unit.kind === 'ministerio'
    ? { ministry_id: unit.id, school_id: null }
    : { ministry_id: null, school_id: unit.id }
}

const unitKey = (unit: BoardUnit) => (unit.kind === 'ministerio' ? 'ministry_id' : 'school_id')

// person_ids do usuário nesta base — lista, não maybeSingle(): há usuários
// com staff_profiles duplicados na mesma base (ver lib/auth/unit-access.ts).
async function staffPersonIds(ctx: Ctx, orgId: string) {
  const { data } = await ctx.supabase
    .from('staff_profiles').select('person_id').eq('organization_id', orgId).eq('user_id', ctx.userId)
  return (data ?? []).map(r => r.person_id).filter((id): id is string => !!id)
}

// Vínculo (líder/membro) com UM ministério específico, direto — sem passar
// pela lista completa de ministérios da pessoa (que busca nome/descrição de
// todo mundo só pra essa checagem de sim/não). Preview preso a um
// ministério não gasta consulta nenhuma extra.
async function resolveMinistryLink(ctx: Ctx, orgId: string, ministryId: string, role: string, preview: RolePreview | null): Promise<'lider' | 'membro' | null> {
  if (preview?.ministryId) {
    if (role !== 'lider_ministerio' && role !== 'obreiro_ministerio') return null
    return preview.ministryId === ministryId ? (role === 'lider_ministerio' ? 'lider' : 'membro') : null
  }

  const { data: leaderRow } = await ctx.supabase
    .from('ministry_leaders').select('ministry_id').eq('ministry_id', ministryId).eq('user_id', ctx.userId).maybeSingle()
  if (leaderRow) return 'lider'

  const personIds = await staffPersonIds(ctx, orgId)
  if (personIds.length === 0) return null

  const { data: memberRows } = await ctx.supabase
    .from('ministry_members').select('ministry_id').eq('ministry_id', ministryId).in('person_id', personIds).eq('active', true).limit(1)
  return memberRows?.length ? 'membro' : null
}

// Mesma coisa pra escola: líder = school_leaders, membro = school_staff ativo.
async function resolveSchoolLink(ctx: Ctx, orgId: string, schoolId: string, role: string, preview: RolePreview | null): Promise<'lider' | 'membro' | null> {
  if (preview?.schoolId) {
    if (role !== 'lider_eted' && role !== 'obreiro_eted') return null
    return preview.schoolId === schoolId ? (role === 'lider_eted' ? 'lider' : 'membro') : null
  }

  const { data: leaderRow } = await ctx.supabase
    .from('school_leaders').select('school_id').eq('school_id', schoolId).eq('user_id', ctx.userId).maybeSingle()
  if (leaderRow) return 'lider'

  const personIds = await staffPersonIds(ctx, orgId)
  if (personIds.length === 0) return null

  const { data: staffRows } = await ctx.supabase
    .from('school_staff').select('school_id').eq('school_id', schoolId).in('person_id', personIds).eq('active', true).limit(1)
  return staffRows?.length ? 'membro' : null
}

// Rede de segurança contra corrida (a checagem de duplicado acima é
// check-then-insert, não atômica): se duas pessoas criam a mesma coluna ao
// mesmo tempo, o índice único (migration 142) barra a segunda no banco —
// aqui só traduz o erro cru do Postgres pra mensagem amigável.
function throwFriendly(error: { code?: string; message: string }): never {
  if (error.code === '23505') throw new Error('Já existe uma coluna com esse nome.')
  throw new Error(error.message)
}

async function requireLink(ctx: Ctx, orgId: string, unit: BoardUnit, requireLeader: boolean) {
  const { role, preview } = await resolveRole(ctx, orgId)
  if (isManagementRole(role)) return
  const link = unit.kind === 'ministerio'
    ? await resolveMinistryLink(ctx, orgId, unit.id, role, preview)
    : await resolveSchoolLink(ctx, orgId, unit.id, role, preview)
  const isMinistry = unit.kind === 'ministerio'
  if (!link) throw new Error(isMinistry ? 'Sem acesso a este ministério.' : 'Sem acesso a esta escola.')
  if (requireLeader && link !== 'lider') throw new Error(`Só o líder ${isMinistry ? 'do ministério' : 'da escola'} pode fazer isso.`)
}

export async function createColumn(formData: FormData) {
  const ctx = await requireUser()
  const unitId = formData.get('unit_id') as string
  const unit: BoardUnit = { kind: formData.get('unit_kind') === 'escola' ? 'escola' : 'ministerio', id: unitId }
  const organizationId = formData.get('organization_id') as string
  const name = (formData.get('name') as string)?.trim()
  const path = formData.get('path') as string
  if (!unitId || !organizationId || !name) return
  await requireLink(ctx, organizationId, unit, true)

  // Uma consulta só: serve tanto pra checar nome duplicado (case-insensitive)
  // quanto pra computar a posição da nova coluna — antes eram 2 consultas
  // separadas (uma pra cada), e cada round-trip a mais até o Supabase
  // hospedado é tempo real na tela (criar coluna chegou a levar ~12s).
  const db = createAdminClient()
  const { data: existing } = await db.from('ministry_board_columns').select('name').eq(unitKey(unit), unit.id)
  const rows = existing ?? []
  if (rows.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Já existe uma coluna com esse nome.')
  }

  const { error } = await db.from('ministry_board_columns').insert({
    organization_id: organizationId,
    ...unitColumns(unit),
    name,
    position: rows.length,
  })
  if (error) throwFriendly(error)
  if (path) revalidatePath(path)
}

export async function renameColumn(formData: FormData) {
  const ctx = await requireUser()
  const id = formData.get('column_id') as string
  const name = (formData.get('name') as string)?.trim()
  const path = formData.get('path') as string
  if (!id || !name) return

  const db = createAdminClient()
  const { data: column } = await db.from('ministry_board_columns').select('organization_id, ministry_id, school_id').eq('id', id).single()
  if (!column) throw new Error('Coluna não encontrada.')
  const unit = unitOf(column)
  await requireLink(ctx, column.organization_id, unit, true)

  const { data: existing } = await db.from('ministry_board_columns').select('id, name').eq(unitKey(unit), unit.id)
  if ((existing ?? []).some(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Já existe uma coluna com esse nome.')
  }

  const { error } = await db.from('ministry_board_columns').update({ name }).eq('id', id)
  if (error) throwFriendly(error)
  if (path) revalidatePath(path)
}

export async function deleteColumn(formData: FormData) {
  const ctx = await requireUser()
  const id = formData.get('column_id') as string
  const path = formData.get('path') as string
  if (!id) return

  const db = createAdminClient()
  const { data: column } = await db.from('ministry_board_columns').select('organization_id, ministry_id, school_id').eq('id', id).single()
  if (!column) throw new Error('Coluna não encontrada.')
  await requireLink(ctx, column.organization_id, unitOf(column), true)

  const { error } = await db.from('ministry_board_columns').delete().eq('id', id)
  if (error) throw new Error(error.message)
  if (path) revalidatePath(path)
}

export async function reorderColumns(orderedIds: string[]) {
  if (orderedIds.length === 0) return
  const ctx = await requireUser()
  const db = createAdminClient()
  const { data: column } = await db.from('ministry_board_columns').select('organization_id, ministry_id, school_id').eq('id', orderedIds[0]).single()
  if (!column) return
  await requireLink(ctx, column.organization_id, unitOf(column), true)

  await Promise.all(orderedIds.map((id, i) =>
    db.from('ministry_board_columns').update({ position: i }).eq('id', id)
  ))
}

function parseCardFields(formData: FormData) {
  return {
    title: (formData.get('title') as string)?.trim(),
    description: (formData.get('description') as string)?.trim() || null,
    priority: (formData.get('priority') as string) || 'media',
    assignee_person_id: (formData.get('assignee_person_id') as string) || null,
    due_date: (formData.get('due_date') as string) || null,
    labels: (() => {
      const raw = (formData.get('labels') as string)?.trim()
      if (!raw) return null
      const list = raw.split(',').map(s => s.trim()).filter(Boolean)
      return list.length ? list : null
    })(),
    announcement_id: (formData.get('announcement_id') as string) || null,
  }
}

export async function createCard(formData: FormData) {
  const columnId = formData.get('column_id') as string
  const path = formData.get('path') as string
  const fields = parseCardFields(formData)
  if (!columnId || !fields.title) return

  const db = createAdminClient()
  // requireUser(), a coluna e a contagem de posição não dependem uma da
  // outra — rodar em paralelo em vez de 3 idas sequenciais ao Supabase
  // hospedado (cada round-trip aqui custa uns 300-700ms) foi o que tirava
  // o "criar tarefa" de ~2s pra mais perto de 1s.
  const [ctx, { data: column }, { count }] = await Promise.all([
    requireUser(),
    db.from('ministry_board_columns').select('ministry_id, school_id, organization_id').eq('id', columnId).single(),
    db.from('ministry_board_cards').select('id', { count: 'exact', head: true }).eq('column_id', columnId),
  ])
  if (!column) throw new Error('Coluna não encontrada.')
  const unit = unitOf(column)
  await requireLink(ctx, column.organization_id, unit, false)

  const { error } = await db.from('ministry_board_cards').insert({
    organization_id: column.organization_id,
    ...unitColumns(unit),
    column_id: columnId,
    position: count ?? 0,
    created_by: ctx.userId,
    ...fields,
  })
  if (error) throw new Error(error.message)
  if (path) revalidatePath(path)
}

export async function updateCard(formData: FormData) {
  const id = formData.get('card_id') as string
  const path = formData.get('path') as string
  const fields = parseCardFields(formData)
  if (!id || !fields.title) return

  const db = createAdminClient()
  const columnId = formData.get('column_id') as string | null
  const [ctx, { data: card }, columnResult] = await Promise.all([
    requireUser(),
    db.from('ministry_board_cards').select('organization_id, ministry_id, school_id').eq('id', id).single(),
    columnId ? db.from('ministry_board_columns').select('is_done').eq('id', columnId).single() : Promise.resolve(null),
  ])
  if (!card) throw new Error('Tarefa não encontrada.')
  await requireLink(ctx, card.organization_id, unitOf(card), false)

  const patch: Record<string, unknown> = { ...fields }
  // Trocar de coluna pelo próprio modal — mesmo efeito do "mover para" do
  // quadro, útil quando arrastar não é prático (mobile/acessibilidade).
  if (columnId) {
    patch.column_id = columnId
    patch.completed_at = columnResult?.data?.is_done ? new Date().toISOString() : null
  }

  const { error } = await db.from('ministry_board_cards').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
  if (path) revalidatePath(path)
}

export async function deleteCard(formData: FormData) {
  const id = formData.get('card_id') as string
  const path = formData.get('path') as string
  if (!id) return

  const db = createAdminClient()
  const [ctx, { data: card }] = await Promise.all([
    requireUser(),
    db.from('ministry_board_cards').select('organization_id, ministry_id, school_id, created_by').eq('id', id).single(),
  ])
  if (!card) throw new Error('Tarefa não encontrada.')
  // Autor do card sempre pode excluir o próprio; senão precisa ser líder/gestão.
  if (card.created_by !== ctx.userId) {
    await requireLink(ctx, card.organization_id, unitOf(card), true)
  }

  const { error } = await db.from('ministry_board_cards').delete().eq('id', id)
  if (error) throw new Error(error.message)
  if (path) revalidatePath(path)
}

// Drag-and-drop: reposiciona/move em lote (arrastar pode afetar a coluna de
// origem inteira + a de destino de uma vez). `doneColumnIds` vem do client
// (que já tem as colunas carregadas) pra não precisar reconsultar.
export async function reorderCards(payload: {
  updates: Array<{ id: string; columnId: string; position: number }>
  doneColumnIds: string[]
  path?: string
}) {
  if (payload.updates.length === 0) return
  const ctx = await requireUser()
  const db = createAdminClient()
  const { data: card } = await db.from('ministry_board_cards').select('organization_id, ministry_id, school_id').eq('id', payload.updates[0].id).single()
  if (!card) return
  await requireLink(ctx, card.organization_id, unitOf(card), false)

  await Promise.all(payload.updates.map(u =>
    db.from('ministry_board_cards').update({
      column_id: u.columnId,
      position: u.position,
      completed_at: payload.doneColumnIds.includes(u.columnId) ? new Date().toISOString() : null,
    }).eq('id', u.id)
  ))
  if (payload.path) revalidatePath(payload.path)
}
