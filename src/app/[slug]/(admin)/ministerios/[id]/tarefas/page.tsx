import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isManagementRole } from '@/lib/auth/permissions'
import { getOrgAndUser, getWorkspaceRole, getWorkspaceMinistry, getWorkspaceMinistryLink } from '../_data'
import { createColumn, renameColumn, deleteColumn, createCard, updateCard, deleteCard, reorderCards } from './actions'
import { TarefasWorkspace } from './TarefasWorkspace'
import type { BoardColumn, BoardCard } from './types'

const DEFAULT_COLUMNS: Array<{ name: string; is_done: boolean }> = [
  { name: 'A Fazer', is_done: false },
  { name: 'Fazendo', is_done: false },
  { name: 'Concluído', is_done: true },
]

type Props = { params: Promise<{ slug: string; id: string }> }

export default async function TarefasPage({ params }: Props) {
  const { slug, id } = await params
  const sbAdmin = createAdminClient()

  const { user, orgId } = await getOrgAndUser(slug)
  if (!user || !orgId) notFound()

  const ministry = await getWorkspaceMinistry(orgId, id)
  if (!ministry) notFound()

  const { role, preview } = await getWorkspaceRole(user.id, orgId)
  const isManagement = isManagementRole(role)
  const link = isManagement ? null : await getWorkspaceMinistryLink(user.id, orgId, role, preview, id)
  const isLeader = isManagement || link === 'lider'

  // Client admin em vez do RLS-aware: quem chega aqui já passou pelo gate
  // de acesso do layout (preview-aware); usar RLS pura pra leitura teria o
  // mesmo problema de "Visualizar como" que as Server Actions tinham (RLS
  // só enxerga o auth.uid() real, sem noção de preview).
  // As 4 consultas não dependem uma da outra — rodar em paralelo em vez de
  // sequencial (await um por um) foi metade do tempo que criar uma tarefa
  // levava pra aparecer, já que o revalidatePath força essa página inteira
  // a refazer essas consultas de novo antes do toast de sucesso aparecer.
  type MemberRow = { person_id: string; people: { full_name: string } | null }

  async function loadColumns() {
    let { data: columnsRaw } = await sbAdmin
      .from('ministry_board_columns')
      .select('id, name, position, is_done')
      .eq('ministry_id', id)
      .order('position', { ascending: true })

    if (!columnsRaw || columnsRaw.length === 0) {
      // Seed preguiçoso na primeira visita. Duas requisições concorrentes
      // podem cair aqui ao mesmo tempo (ex.: dois usuários abrindo o
      // quadro juntos) — o índice único (migration 142) rejeita a segunda
      // tentativa inteira (insert em lote é atômico), sem problema: só
      // relemos o que já existe.
      await sbAdmin.from('ministry_board_columns').insert(
        DEFAULT_COLUMNS.map((c, i) => ({ organization_id: orgId, ministry_id: id, name: c.name, position: i, is_done: c.is_done }))
      )
      const { data: seeded } = await sbAdmin
        .from('ministry_board_columns')
        .select('id, name, position, is_done')
        .eq('ministry_id', id)
        .order('position', { ascending: true })
      columnsRaw = seeded
    }
    return (columnsRaw ?? []) as BoardColumn[]
  }

  const [columns, cardsRaw, membersRaw, announcementsRaw] = await Promise.all([
    loadColumns(),
    sbAdmin
      .from('ministry_board_cards')
      .select('id, column_id, title, description, position, priority, assignee_person_id, due_date, labels, announcement_id, completed_at, created_by')
      .eq('ministry_id', id)
      .order('position', { ascending: true })
      .then(r => r.data),
    sbAdmin
      .from('ministry_members')
      .select('person_id, people(full_name)')
      .eq('ministry_id', id)
      .eq('active', true)
      .then(r => r.data),
    sbAdmin
      .from('base_announcements')
      .select('id, title')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(r => r.data),
  ])

  const cards = (cardsRaw ?? []) as BoardCard[]
  const members = ((membersRaw ?? []) as unknown as MemberRow[])
    .filter((m): m is MemberRow & { people: { full_name: string } } => !!m.people)
    .map(m => ({ id: m.person_id, name: m.people.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const announcements = announcementsRaw ?? []

  const path = `/${slug}/ministerios/${id}/tarefas`

  return (
    <main className="p-4 md:p-6 overflow-y-auto flex-1">
      <TarefasWorkspace
        ministryId={id}
        organizationId={orgId}
        path={path}
        isLeader={isLeader}
        columns={columns}
        cards={cards}
        members={members}
        announcements={announcements}
        createColumn={createColumn}
        renameColumn={renameColumn}
        deleteColumn={deleteColumn}
        createCard={createCard}
        updateCard={updateCard}
        deleteCard={deleteCard}
        reorderCards={reorderCards}
      />
    </main>
  )
}
