import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { MANAGEMENT_ROLES, isOperationalManager, canAssignLeadership } from '@/lib/auth/permissions'
import { loadStaffRoleOptions } from '@/lib/staff/roleOptions'
import { ObreiroCard } from '../../../obreiros/ObreirosClientForms'
import { criarAcessoComEmail, adicionarTelefonePessoa, marcarCredencialEnviada, removerAcesso } from './actions'
import { CriarAcessoForm } from './CriarAcessoForm'
import { SetAsLeaderCard } from './SetAsLeaderCard'
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton'
import { addSchoolCoLeaderByPerson } from '../../../escolas/[id]/actions'
import { addMinistryCoLeaderByPerson } from '../../../ministerios/[id]/actions'

type Props = {
  params: Promise<{ slug: string; personId: string }>
  searchParams: Promise<{ msg?: string; erro?: string }>
}

export default async function PessoaAcessoPage({ params, searchParams }: Props) {
  const { slug, personId } = await params
  const { msg, erro } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id, name, role_accumulations').eq('slug', slug).single()
  if (!org) notFound()

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!MANAGEMENT_ROLES.includes(role as never)) redirect(`/${slug}/pessoas/${personId}/carteirinha`)

  const db = createAdminClient()
  const { data: person } = await db.from('people').select('id, full_name').eq('id', personId).eq('organization_id', org.id).single()
  if (!person) notFound()

  const canAssignLeader = canAssignLeadership(role)

  const handleSetAsLeader = async (formData: FormData) => {
    'use server'
    const unitType = formData.get('unit_type') as string
    const unitId = formData.get('unit_id') as string
    if (!unitId) return
    const result = unitType === 'school'
      ? await addSchoolCoLeaderByPerson(org.id, unitId, personId)
      : await addMinistryCoLeaderByPerson(org.id, unitId, personId)
    if (result.error) redirect(`/${slug}/pessoas/${personId}/acesso?erro=${encodeURIComponent(result.error)}`)
    redirect(`/${slug}/pessoas/${personId}/acesso?msg=lider_atribuido`)
  }

  const msgs: Record<string, { text: string; cls: string }> = {
    lider_atribuido: { text: 'Líder atribuído com sucesso.', cls: 'bg-green-50 border-green-200 text-green-700' },
  }

  const { data: staffProfile } = await db
    .from('staff_profiles')
    .select('id, user_id, role_title, area, active')
    .eq('organization_id', org.id)
    .eq('person_id', personId)
    .maybeSingle()

  if (!staffProfile?.user_id) {
    const { schools, ministries } = canAssignLeader
      ? await loadStaffRoleOptions(supabase, org.id)
      : { schools: [], ministries: [] }
    return (
      <main className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        {msg && msgs[msg] && (
          <div className={`border rounded-lg px-4 py-3 text-sm ${msgs[msg].cls}`}>{msgs[msg].text}</div>
        )}
        {erro && (
          <div className="border rounded-lg px-4 py-3 text-sm bg-red-50 border-red-200 text-red-700">{erro}</div>
        )}
        {staffProfile ? (
          <CriarAcessoForm
            action={criarAcessoComEmail.bind(null, personId, org.id, slug)}
            addPhoneAction={adicionarTelefonePessoa.bind(null, personId)}
            markSentAction={marcarCredencialEnviada}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-sm text-gray-400">Essa pessoa ainda não tem perfil de obreiro.</p>
          </div>
        )}
        {canAssignLeader && (
          <SetAsLeaderCard action={handleSetAsLeader} schools={schools} ministries={ministries} />
        )}
      </main>
    )
  }

  type OrgUserRow = { id: string; active: boolean; extra_roles: string[] | null; roles: { id: string; name: string; label: string } | null }
  type MinistryLinkRaw = { ministries: { name: string } | null }

  const [{ data: orgUserRaw }, { roles, schools, ministries }, { data: authUser }, { data: ministryLinksRaw }] = await Promise.all([
    db.from('organization_users').select('id, active, extra_roles, roles(id, name, label)').eq('organization_id', org.id).eq('user_id', staffProfile.user_id).maybeSingle(),
    loadStaffRoleOptions(supabase, org.id),
    db.auth.admin.getUserById(staffProfile.user_id),
    db.from('ministry_members').select('ministries(name)').eq('person_id', personId).eq('active', true),
  ])

  const orgUser = orgUserRaw as unknown as OrgUserRow | null
  if (!orgUser) notFound()

  const ministryNames = ((ministryLinksRaw ?? []) as unknown as MinistryLinkRaw[])
    .filter(l => l.ministries)
    .map(l => l.ministries!.name)
    .join(', ')
  const effectiveArea = staffProfile.area ?? (ministryNames || null)

  const orgAccumulations = (org.role_accumulations as Record<string, string[]> | null) ?? {}
  const viewerIsDH = role === 'dh'

  const handleRemoverAcesso = async () => {
    'use server'
    await removerAcesso(personId, org.id)
    redirect(`/${slug}/pessoas/${personId}/acesso`)
  }

  return (
    <main className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      {msg && msgs[msg] && (
        <div className={`border rounded-lg px-4 py-3 text-sm ${msgs[msg].cls}`}>{msgs[msg].text}</div>
      )}
      {erro && (
        <div className="border rounded-lg px-4 py-3 text-sm bg-red-50 border-red-200 text-red-700">{erro}</div>
      )}
      <ObreiroCard
        orgUserId={orgUser.id}
        userId={staffProfile.user_id}
        currentRoleId={orgUser.roles?.id ?? ''}
        currentRoleName={orgUser.roles?.name ?? ''}
        currentArea={effectiveArea}
        currentRoleTitle={staffProfile.role_title}
        roles={roles}
        schools={schools}
        ministries={ministries}
        slug={slug}
        orgId={org.id}
        fullName={person.full_name}
        email={authUser.user?.email ?? '—'}
        active={orgUser.active}
        isCurrentUser={staffProfile.user_id === user.id}
        accumulatedRoleLabels={(orgAccumulations[orgUser.roles?.name ?? ''] ?? []).map(r => roles.find(role => role.name === r)?.label ?? r)}
        currentExtraRoles={orgUser.extra_roles ?? []}
        viewerIsDH={viewerIsDH}
        readOnly={!isOperationalManager(role)}
        redirectTo={`/${slug}/pessoas/${personId}/acesso`}
      />
      {canAssignLeader && (
        <SetAsLeaderCard action={handleSetAsLeader} schools={schools} ministries={ministries} />
      )}
      {isOperationalManager(role) && (
        <form action={handleRemoverAcesso} className="bg-white rounded-xl border border-red-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Remover acesso</h2>
          <p className="text-xs text-gray-400 mb-3">
            Apaga o login e o e-mail cadastrado dessa pessoa — ela volta pro estado &ldquo;sem login&rdquo;,
            pronta pra recriar o acesso do zero (útil se o e-mail foi digitado errado, por exemplo).
          </p>
          <ConfirmSubmitButton
            confirmMessage={`Remover o acesso de ${person.full_name}? Isso apaga o login (${authUser.user?.email ?? 'sem e-mail'}) e o e-mail cadastrado — não dá pra desfazer.`}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            Remover acesso
          </ConfirmSubmitButton>
        </form>
      )}
    </main>
  )
}
