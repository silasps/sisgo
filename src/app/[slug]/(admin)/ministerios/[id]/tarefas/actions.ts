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

// Vínculo (líder/membro) com UM ministério específico, direto — sem passar
// pela lista completa de ministérios da pessoa (que busca nome/descrição de
// todo mundo só pra essa checagem de sim/não). Preview preso a um
// ministério não gasta consulta nenhuma extra.
async function resolveLink(ctx: Ctx, orgId: string, ministryId: string, role: string, preview: RolePreview | null): Promise<'lider' | 'membro' | null> {
  if (preview?.ministryId) {
    if (role !== 'lider_ministerio' && role !== 'obreiro_ministerio') return null
    return preview.ministryId === ministryId ? (role === 'lider_ministerio' ? 'lider' : 'membro') : null
  }

  const { data: leaderRow } = await ctx.supabase
    .from('ministry_leaders').select('ministry_id').eq('ministry_id', ministryId).eq('user_id', ctx.userId).maybeSingle()
  if (leaderRow) return 'lider'

  const { data: staffProfile } = await ctx.supabase
    .from('staff_profiles').select('person_id').eq('organization_id', orgId).eq('user_id', ctx.userId).maybeSingle()
  if (!staffProfile?.person_id) return null

  const { data: memberRow } = await ctx.supabase
    .from('ministry_members').select('ministry_id').eq('ministry_id', ministryId).eq('person_id', staffProfile.person_id).eq('active', true).maybeSingle()
  return memberRow ? 'membro' : null
}

// Rede de segurança contra corrida (a checagem de duplicado acima é
// check-then-insert, não atômica): se duas pessoas criam a mesma coluna ao
// mesmo tempo, o índice único (migration 142) barra a segunda no banco —
// aqui só traduz o erro cru do Postgres pra mensagem amigável.
function throwFriendly(error: { code?: string; message: string }): never {
  if (error.code === '23505') throw new Error('Já existe uma coluna com esse nome.')
  throw new Error(error.message)
}

async function requireLink(ctx: Ctx, orgId: string, ministryId: string, requireLeader: boolean) {
  const { role, preview } = await resolveRole(ctx, orgId)
  if (isManagementRole(role)) return
  const link = await resolveLink(ctx, orgId, ministryId, role, preview)
  if (!link) throw new Error('Sem acesso a este ministério.')
  if (requireLeader && link !== 'lider') throw new Error('Só o líder do ministério pode fazer isso.')
}

export async function createColumn(formData: FormData) {
  const ctx = await requireUser()
  const ministryId = formData.get('ministry_id') as string
  const organizationId = formData.get('organization_id') as string
  const name = (formData.get('name') as string)?.trim()
  const path = formData.get('path') as string
  if (!ministryId || !organizationId || !name) return
  await requireLink(ctx, organizationId, ministryId, true)

  // Uma consulta só: serve tanto pra checar nome duplicado (case-insensitive)
  // quanto pra computar a posição da nova coluna — antes eram 2 consultas
  // separadas (uma pra cada), e cada round-trip a mais até o Supabase
  // hospedado é tempo real na tela (criar coluna chegou a levar ~12s).
  const db = createAdminClient()
  const { data: existing } = await db.from('ministry_board_columns').select('name').eq('ministry_id', ministryId)
  const rows = existing ?? []
  if (rows.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Já existe uma coluna com esse nome.')
  }

  const { error } = await db.from('ministry_board_columns').insert({
    organization_id: organizationId,
    ministry_id: ministryId,
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
  const { data: column } = await db.from('ministry_board_columns').select('organization_id, ministry_id').eq('id', id).single()
  if (!column) throw new Error('Coluna não encontrada.')
  await requireLink(ctx, column.organization_id, column.ministry_id, true)

  const { data: existing } = await db.from('ministry_board_columns').select('id, name').eq('ministry_id', column.ministry_id)
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
  const { data: column } = await db.from('ministry_board_columns').select('organization_id, ministry_id').eq('id', id).single()
  if (!column) throw new Error('Coluna não encontrada.')
  await requireLink(ctx, column.organization_id, column.ministry_id, true)

  const { error } = await db.from('ministry_board_columns').delete().eq('id', id)
  if (error) throw new Error(error.message)
  if (path) revalidatePath(path)
}

export async function reorderColumns(orderedIds: string[]) {
  if (orderedIds.length === 0) return
  const ctx = await requireUser()
  const db = createAdminClient()
  const { data: column } = await db.from('ministry_board_columns').select('organization_id, ministry_id').eq('id', orderedIds[0]).single()
  if (!column) return
  await requireLink(ctx, column.organization_id, column.ministry_id, true)

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
    db.from('ministry_board_columns').select('ministry_id, organization_id').eq('id', columnId).single(),
    db.from('ministry_board_cards').select('id', { count: 'exact', head: true }).eq('column_id', columnId),
  ])
  if (!column) throw new Error('Coluna não encontrada.')
  await requireLink(ctx, column.organization_id, column.ministry_id, false)

  const { error } = await db.from('ministry_board_cards').insert({
    organization_id: column.organization_id,
    ministry_id: column.ministry_id,
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
    db.from('ministry_board_cards').select('organization_id, ministry_id').eq('id', id).single(),
    columnId ? db.from('ministry_board_columns').select('is_done').eq('id', columnId).single() : Promise.resolve(null),
  ])
  if (!card) throw new Error('Tarefa não encontrada.')
  await requireLink(ctx, card.organization_id, card.ministry_id, false)

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
    db.from('ministry_board_cards').select('organization_id, ministry_id, created_by').eq('id', id).single(),
  ])
  if (!card) throw new Error('Tarefa não encontrada.')
  // Autor do card sempre pode excluir o próprio; senão precisa ser líder/gestão.
  if (card.created_by !== ctx.userId) {
    await requireLink(ctx, card.organization_id, card.ministry_id, true)
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
  const { data: card } = await db.from('ministry_board_cards').select('organization_id, ministry_id').eq('id', payload.updates[0].id).single()
  if (!card) return
  await requireLink(ctx, card.organization_id, card.ministry_id, false)

  await Promise.all(payload.updates.map(u =>
    db.from('ministry_board_cards').update({
      column_id: u.columnId,
      position: u.position,
      completed_at: payload.doneColumnIds.includes(u.columnId) ? new Date().toISOString() : null,
    }).eq('id', u.id)
  ))
  if (payload.path) revalidatePath(payload.path)
}
