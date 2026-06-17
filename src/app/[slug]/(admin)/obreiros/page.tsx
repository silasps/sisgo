import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getRolePreview } from '@/lib/role-preview'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { isManagementRole } from '@/lib/auth/permissions'
import { SearchBar } from '@/components/ui/SearchBar'
import { ObreiroCard, CreateObreiroModal } from './ObreirosClientForms'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> }

type RoleRow = { id: string; name: string; label: string }
type OrgUserRow = {
  id: string
  user_id: string
  active: boolean
  created_at: string
  roles: RoleRow | null
  extra_roles?: string[] | null
}
type StaffProfileRow = {
  id: string
  user_id: string | null
  role_title: string | null
  area: string | null
  active: boolean
  people: { full_name: string } | null
}

const STAFF_ROLE_ORDER = ['dh', 'secretaria', 'hospitalidade', 'cozinha', 'lider_eted', 'obreiro_eted', 'lider_ministerio', 'obreiro_ministerio']
const BLOCKED_ROLE_NAMES = ['superadmin', 'admin_base', 'lider_base']
const REQUIRED_STAFF_ROLES: Record<string, { label: string; description: string }> = {
  lider_eted: {
    label: 'Líder de Escola',
    description: 'Gestão da sua escola: alunos, inscrições, obreiros e turmas',
  },
  obreiro_eted: {
    label: 'Obreiro de Escola',
    description: 'Acesso restrito à escola onde serve',
  },
}

function roleLabel(role: RoleRow) {
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

export default async function ObreirosPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { q } = await searchParams
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, role_accumulations')
    .eq('slug', slug)
    .single()

  if (!org) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)

  const membershipRows = (memberships ?? []) as unknown as Array<{
    organization_id: string | null
    roles: { name: string } | null
  }>
  const realRole = membershipRows.find(row => row.roles?.name === 'superadmin')?.roles?.name
    ?? membershipRows.find(row => row.organization_id === org.id)?.roles?.name
    ?? ''
  const preview = await getRolePreview(realRole)
  const role = preview?.role ?? realRole

  if (!isManagementRole(role)) notFound()

  const [{ data: orgUsers }, { data: allRoles }, { data: profilesRaw }, { data: authUsersData }, { data: schoolsRaw }, { data: ministriesRaw }] = await Promise.all([
    supabase
      .from('organization_users')
      .select('id, user_id, active, created_at, roles(id, name, label), extra_roles')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('roles')
      .select('id, name, label')
      .not('name', 'in', `("${BLOCKED_ROLE_NAMES.join('","')}")`)
      .order('name'),
    admin
      .from('staff_profiles')
      .select('id, user_id, role_title, area, active, people(full_name)')
      .eq('organization_id', org.id),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    supabase
      .from('schools')
      .select('id, name')
      .eq('organization_id', org.id)
      .eq('active', true)
      .order('name'),
    supabase
      .from('ministries')
      .select('id, name')
      .eq('organization_id', org.id)
      .eq('active', true)
      .order('name'),
  ])

  const orgAccumulations = (org?.role_accumulations as Record<string, string[]> | null) ?? {}
  const roles = sortRoles(withRequiredStaffRoles(((allRoles ?? []) as RoleRow[]).filter(r => STAFF_ROLE_ORDER.includes(r.name))))
    .map(role => ({ ...role, label: roleLabel(role) }))
  const schools = (schoolsRaw ?? []) as { id: string; name: string }[]
  const ministries = (ministriesRaw ?? []) as { id: string; name: string }[]
  const authMap = new Map(authUsersData.users.map(authUser => [authUser.id, authUser]))
  const profileByUserId = new Map(
    ((profilesRaw ?? []) as unknown as StaffProfileRow[])
      .filter(profile => profile.user_id)
      .map(profile => [profile.user_id as string, profile])
  )

  const viewerIsDH = role === 'dh' || realRole === 'superadmin'

  const rows = ((orgUsers ?? []) as unknown as OrgUserRow[])
    .filter(row => row.roles && STAFF_ROLE_ORDER.includes(row.roles.name))
    .map(row => {
      const authUser = authMap.get(row.user_id)
      const profile = profileByUserId.get(row.user_id)
      const metadataName = authUser?.user_metadata?.full_name
        ?? authUser?.user_metadata?.name
        ?? authUser?.user_metadata?.display_name
      const displayName = profile?.people?.full_name
        ?? (typeof metadataName === 'string' ? metadataName : null)
        ?? authUser?.email
        ?? 'Usuário sem e-mail'

      return {
        ...row,
        email: authUser?.email ?? '—',
        full_name: displayName,
        profile,
      }
    })

  const filteredRows = q
    ? rows.filter(r => r.full_name.toLowerCase().includes(q.toLowerCase()))
    : rows
  const activeCount = rows.filter(r => r.active).length

  return (
    <>
      <Header
        title={`Obreiros — ${org.name}`}
        actions={
          <div className="flex items-center gap-3">
            <CreateObreiroModal roles={roles} schools={schools} ministries={ministries} orgId={org.id} slug={slug} />
            <Link href={`/${slug}/pessoas?tab=obreiros`} className="text-sm text-gray-500 hover:text-gray-700">
              Ver cadastro de pessoas
            </Link>
          </div>
        }
      />
      <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">Acessos de obreiros</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {rows.length === 0
                  ? 'Nenhum obreiro cadastrado ainda.'
                  : `${activeCount} ativo${activeCount !== 1 ? 's' : ''} · ${rows.length - activeCount} inativo${rows.length - activeCount !== 1 ? 's' : ''}`}
              </p>
            </div>
            <Suspense>
              <SearchBar placeholder="Buscar por nome…" className="w-full sm:w-64" />
            </Suspense>
          </div>

          {!rows.length ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-sm text-gray-400">Nenhum obreiro com acesso cadastrado ainda.</p>
            </div>
          ) : !filteredRows.length ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-sm text-gray-400">Nenhum resultado para &ldquo;{q}&rdquo;.</p>
            </div>
          ) : (
            <div className="space-y-3 animate-stagger">
              {filteredRows.map(row => (
                <ObreiroCard
                  key={row.id}
                  orgUserId={row.id}
                  userId={row.user_id}
                  currentRoleId={row.roles?.id ?? ''}
                  currentRoleName={row.roles?.name ?? ''}
                  currentArea={row.profile?.area}
                  currentRoleTitle={row.profile?.role_title}
                  roles={roles}
                  schools={schools}
                  ministries={ministries}
                  slug={slug}
                  orgId={org.id}
                  fullName={row.full_name}
                  email={row.email}
                  active={row.active}
                  isCurrentUser={row.user_id === user.id}
                  accumulatedRoleLabels={(orgAccumulations[row.roles?.name ?? ''] ?? []).map(r => roles.find(role => role.name === r)?.label ?? r)}
                  currentExtraRoles={(row.extra_roles as string[] | null) ?? []}
                  viewerIsDH={viewerIsDH}
                />
              ))}
            </div>
          )}
        </section>

      </main>
    </>
  )
}
