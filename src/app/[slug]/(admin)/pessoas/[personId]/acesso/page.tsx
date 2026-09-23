import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { MANAGEMENT_ROLES, isOperationalManager } from '@/lib/auth/permissions'
import { loadStaffRoleOptions } from '@/lib/staff/roleOptions'
import { ObreiroCard } from '../../../obreiros/ObreirosClientForms'
import { criarAcessoComEmail } from './actions'
import { CriarAcessoForm } from './CriarAcessoForm'

type Props = { params: Promise<{ slug: string; personId: string }> }

export default async function PessoaAcessoPage({ params }: Props) {
  const { slug, personId } = await params
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

  const { data: staffProfile } = await db
    .from('staff_profiles')
    .select('id, user_id, role_title, area, active')
    .eq('organization_id', org.id)
    .eq('person_id', personId)
    .maybeSingle()

  if (!staffProfile?.user_id) {
    return (
      <main className="p-4 md:p-6 max-w-2xl mx-auto">
        {staffProfile ? (
          <CriarAcessoForm action={criarAcessoComEmail.bind(null, personId, org.id, slug)} />
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-sm text-gray-400">Essa pessoa ainda não tem perfil de obreiro.</p>
          </div>
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

  return (
    <main className="p-4 md:p-6 max-w-2xl mx-auto">
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
    </main>
  )
}
