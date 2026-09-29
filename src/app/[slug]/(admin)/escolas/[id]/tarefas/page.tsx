import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { getSchoolLink } from '@/lib/auth/unit-access'
import { createColumn, renameColumn, deleteColumn, createCard, updateCard, deleteCard, reorderCards } from '../../../ministerios/[id]/tarefas/actions'
import { TarefasWorkspace } from '../../../ministerios/[id]/tarefas/TarefasWorkspace'
import { loadBoard } from '../../../ministerios/[id]/tarefas/board-data'

type Props = { params: Promise<{ slug: string; id: string }> }

// Quadro de Tarefas da escola — o mesmo do ministério (componentes, actions e
// tabelas; migration 156), só que da escola: líder = school_leaders,
// responsáveis possíveis = quadro de obreiros da escola.
export default async function EscolaTarefasPage({ params }: Props) {
  const { slug, id } = await params
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()
  const orgId = org.id

  // Só quem tem vínculo com ESTA escola (líder/obreiro) usa as Tarefas — a
  // gestão sem vínculo volta pra página da escola.
  const { role, preview } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const link = await getSchoolLink({ userId: user.id, orgId, role, preview }, id)
  if (!link) redirect(`/${slug}/escolas/${id}`)
  const isLeader = link === 'lider'

  type StaffRow = { person_id: string; people: { full_name: string } | null }

  const [{ columns, cards }, { data: staffRaw }, { data: announcementsRaw }] = await Promise.all([
    loadBoard(sbAdmin, orgId, { kind: 'escola', id }),
    sbAdmin
      .from('school_staff')
      .select('person_id, people(full_name)')
      .eq('school_id', id)
      .eq('active', true),
    sbAdmin
      .from('base_announcements')
      .select('id, title')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const members = ((staffRaw ?? []) as unknown as StaffRow[])
    .filter((m): m is StaffRow & { people: { full_name: string } } => !!m.people)
    .map(m => ({ id: m.person_id, name: m.people.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <main className="p-4 md:p-6 overflow-y-auto flex-1">
      <TarefasWorkspace
        unitKind="escola"
        unitId={id}
        organizationId={orgId}
        path={`/${slug}/escolas/${id}/tarefas`}
        isLeader={isLeader}
        columns={columns}
        cards={cards}
        members={members}
        announcements={announcementsRaw ?? []}
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
