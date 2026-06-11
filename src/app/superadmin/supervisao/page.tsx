import { Header } from '@/components/layout/Header'
import { createAdminClient } from '@/lib/supabase/admin'
import { asLooseClient } from '@/lib/supabase/loose-client'
import { redirect } from 'next/navigation'

type Group = { id: string; name: string; description: string | null; parent_group_id: string | null; active: boolean }
type Org = { id: string; name: string; slug: string; city: string | null; state: string | null; active: boolean }
type GroupOrg = { group_id: string; organization_id: string }
type GroupLeader = { group_id: string; user_id: string; active: boolean }
type DirectSupervisor = { organization_id: string; user_id: string; active: boolean }

export default async function SupervisaoBasesPage() {
  const adminClient = createAdminClient()
  const admin = asLooseClient(adminClient)

  const [
    { data: groupsData },
    { data: orgsData },
    { data: groupOrgsData },
    { data: leadersData },
    { data: directData },
    { data: { users } },
  ] = await Promise.all([
    admin.from('base_groups').select('id, name, description, parent_group_id, active').order('name'),
    admin.from('organizations').select('id, name, slug, city, state, active').order('name'),
    admin.from('base_group_organizations').select('group_id, organization_id'),
    admin.from('base_group_leaders').select('group_id, user_id, active'),
    admin.from('base_supervisors').select('organization_id, user_id, active'),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const groups = (groupsData ?? []) as Group[]
  const orgs = (orgsData ?? []) as Org[]
  const groupOrgs = (groupOrgsData ?? []) as GroupOrg[]
  const leaders = (leadersData ?? []) as GroupLeader[]
  const directSupervisors = (directData ?? []) as DirectSupervisor[]
  const userMap = new Map(users.map(user => [user.id, {
    email: user.email ?? 'sem e-mail',
    name: (user.user_metadata?.full_name as string | undefined) ?? '',
  }]))

  async function createGroup(formData: FormData) {
    'use server'
    const db = asLooseClient(createAdminClient())
    const name = String(formData.get('name') ?? '').trim()
    if (!name) redirect('/superadmin/supervisao')

    await db.from('base_groups').insert({
      name,
      description: String(formData.get('description') ?? '').trim() || null,
      parent_group_id: String(formData.get('parent_group_id') ?? '') || null,
      active: true,
    })
    redirect('/superadmin/supervisao')
  }

  async function addBaseToGroup(formData: FormData) {
    'use server'
    const db = asLooseClient(createAdminClient())
    await db.from('base_group_organizations').insert({
      group_id: String(formData.get('group_id') ?? ''),
      organization_id: String(formData.get('organization_id') ?? ''),
    })
    await syncSupervisorOrgUsers(createAdminClient())
    redirect('/superadmin/supervisao')
  }

  async function addGroupLeader(formData: FormData) {
    'use server'
    const dbClient = createAdminClient()
    const db = asLooseClient(dbClient)
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const userId = await getOrCreateSupervisorUser(dbClient, formData, email)
    if (!userId) return
    await db.from('base_group_leaders').insert({
      group_id: String(formData.get('group_id') ?? ''),
      user_id: userId,
      active: true,
    })
    await syncSupervisorOrgUsers(dbClient)
    redirect('/superadmin/supervisao')
  }

  async function addDirectSupervisor(formData: FormData) {
    'use server'
    const dbClient = createAdminClient()
    const db = asLooseClient(dbClient)
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const userId = await getOrCreateSupervisorUser(dbClient, formData, email)
    if (!userId) return
    await db.from('base_supervisors').insert({
      organization_id: String(formData.get('organization_id') ?? ''),
      user_id: userId,
      active: true,
    })
    await syncSupervisorOrgUsers(dbClient)
    redirect('/superadmin/supervisao')
  }

  async function createSupervisorUser(formData: FormData) {
    'use server'
    const dbClient = createAdminClient()
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const fullName = String(formData.get('full_name') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    if (!email || !fullName || password.length < 6) return

    const existing = await findAuthUserByEmail(dbClient, email)
    const userId = existing?.id ?? (await createAuthUser(dbClient, { email, fullName, password }))
    if (!userId) return

    await ensureSupervisorRole(dbClient, userId)
    redirect('/superadmin/supervisao')
  }

  return (
    <>
      <Header title="Supervisão de bases" />
      <main className="p-4 md:p-6 space-y-6">
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <h2 className="text-sm font-semibold text-blue-950">Modelo híbrido</h2>
          <p className="mt-1 text-sm text-blue-700">
            Supervisores podem receber bases diretamente ou liderar grupos. Grupos também podem ter subgrupos, então uma rede pode conter regionais, e cada regional pode conter bases.
          </p>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Panel title="Criar usuário supervisor">
            <form action={createSupervisorUser} className="space-y-3">
              <Field name="full_name" label="Nome completo" required placeholder="Nome do líder/supervisor" />
              <Field name="email" label="E-mail" type="email" required placeholder="supervisor@exemplo.com" />
              <Field name="password" label="Senha temporária" type="password" required placeholder="Mínimo 6 caracteres" minLength={6} />
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Criar supervisor</button>
              <p className="text-xs text-gray-400">
                Depois de criar, vincule este usuário a um grupo ou diretamente a uma base abaixo.
              </p>
            </form>
          </Panel>

          <Panel title="Criar grupo de bases">
            <form action={createGroup} className="space-y-3">
              <Field name="name" label="Nome do grupo" required placeholder="Ex: Regional Sul, Rede Norte..." />
              <Select name="parent_group_id" label="Grupo acima" options={[['', 'Nenhum'], ...groups.map(group => [group.id, group.name] as [string, string])]} />
              <Field name="description" label="Descrição" placeholder="Opcional" />
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Criar grupo</button>
              <p className="text-xs text-gray-400">
                Depois de criar, adicione as bases e vincule um líder para esse grupo.
              </p>
            </form>
          </Panel>

          <Panel title="Atribuir base a grupo">
            <form action={addBaseToGroup} className="space-y-3">
              <Select name="group_id" label="Grupo" options={groups.map(group => [group.id, group.name] as [string, string])} />
              <Select name="organization_id" label="Base" options={orgs.map(org => [org.id, org.name] as [string, string])} />
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Adicionar base</button>
            </form>
          </Panel>

          <Panel title="Líder de grupo">
            <form action={addGroupLeader} className="space-y-3">
              <Select name="group_id" label="Grupo" options={groups.map(group => [group.id, group.name] as [string, string])} />
              <Field name="email" label="E-mail do usuário" type="email" required placeholder="lider@exemplo.com" />
              <Field name="full_name" label="Nome, se precisar criar" placeholder="Opcional se o e-mail já existir" />
              <Field name="password" label="Senha temporária, se precisar criar" type="password" placeholder="Opcional se o e-mail já existir" minLength={6} />
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Vincular líder</button>
            </form>
          </Panel>

          <Panel title="Supervisor direto de base">
            <form action={addDirectSupervisor} className="space-y-3">
              <Select name="organization_id" label="Base" options={orgs.map(org => [org.id, org.name] as [string, string])} />
              <Field name="email" label="E-mail do usuário" type="email" required placeholder="supervisor@exemplo.com" />
              <Field name="full_name" label="Nome, se precisar criar" placeholder="Opcional se o e-mail já existir" />
              <Field name="password" label="Senha temporária, se precisar criar" type="password" placeholder="Opcional se o e-mail já existir" minLength={6} />
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Vincular supervisor</button>
            </form>
          </Panel>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Grupos configurados</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {groups.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Nenhum grupo criado ainda.</p>
            ) : groups.map(group => {
              const bases = groupOrgs.filter(item => item.group_id === group.id).map(item => orgs.find(org => org.id === item.organization_id)?.name).filter(Boolean)
              const groupLeaders = leaders.filter(item => item.group_id === group.id && item.active).map(item => userMap.get(item.user_id)?.email ?? item.user_id)
              return (
                <div key={group.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{group.name}</p>
                      <p className="text-xs text-gray-400">{group.description ?? 'Sem descrição'}</p>
                    </div>
                    {group.parent_group_id && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Subgrupo</span>}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">Bases: {bases.length ? bases.join(', ') : 'nenhuma'}</p>
                  <p className="mt-1 text-xs text-gray-500">Líderes: {groupLeaders.length ? groupLeaders.join(', ') : 'nenhum'}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Supervisores diretos</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {directSupervisors.filter(item => item.active).length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Nenhum vínculo direto cadastrado.</p>
            ) : directSupervisors.filter(item => item.active).map((item, index) => (
              <div key={`${item.organization_id}-${item.user_id}-${index}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm font-medium text-gray-900">{userMap.get(item.user_id)?.email ?? item.user_id}</p>
                <p className="text-sm text-gray-500">{orgs.find(org => org.id === item.organization_id)?.name ?? 'Base'}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}

async function findAuthUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  return users.find(user => user.email?.toLowerCase() === email)
}

async function createAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  input: { email: string; fullName: string; password: string }
) {
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    user_metadata: { full_name: input.fullName },
    email_confirm: true,
  })
  if (error || !data.user) return null
  return data.user.id
}

async function getOrCreateSupervisorUser(
  admin: ReturnType<typeof createAdminClient>,
  formData: FormData,
  email: string
) {
  const existing = await findAuthUserByEmail(admin, email)
  if (existing?.id) {
    await ensureSupervisorRole(admin, existing.id)
    return existing.id
  }

  const fullName = String(formData.get('full_name') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!fullName || password.length < 6) return null

  const userId = await createAuthUser(admin, { email, fullName, password })
  if (!userId) return null
  await ensureSupervisorRole(admin, userId)
  return userId
}

async function ensureSupervisorRole(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data: role } = await admin.from('roles').select('id').eq('name', 'supervisor_bases').single()
  if (!role?.id) return
  const { data: existing } = await admin
    .from('organization_users')
    .select('id')
    .eq('user_id', userId)
    .is('organization_id', null)
    .maybeSingle()

  if (existing?.id) {
    await admin.from('organization_users').update({ role_id: role.id, active: true, updated_at: new Date().toISOString() }).eq('id', existing.id)
  } else {
    await admin.from('organization_users').insert({ user_id: userId, organization_id: null, role_id: role.id, active: true })
  }
}

async function syncSupervisorOrgUsers(admin: ReturnType<typeof createAdminClient>) {
  const db = asLooseClient(admin)
  const [{ data: leadersData }, { data: directData }, { data: leaderRole }] = await Promise.all([
    db.from('base_group_leaders').select('user_id').eq('active', true),
    db.from('base_supervisors').select('user_id').eq('active', true),
    admin.from('roles').select('id').eq('name', 'lider_base').single(),
  ])
  if (!leaderRole?.id) return

  const userIds = Array.from(new Set([
    ...((leadersData ?? []) as Array<{ user_id: string }>).map(item => item.user_id),
    ...((directData ?? []) as Array<{ user_id: string }>).map(item => item.user_id),
  ]))

  for (const userId of userIds) {
    await ensureSupervisorRole(admin, userId)
    const { data: orgIdsData } = await db.rpc('supervised_base_ids', { target_user_id: userId })
    const orgIds = ((orgIdsData ?? []) as Array<{ organization_id: string }>).map(item => item.organization_id)

    for (const orgId of orgIds) {
      const { data: existing } = await admin
        .from('organization_users')
        .select('id')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
        .maybeSingle()

      if (existing?.id) {
        await admin.from('organization_users')
          .update({ role_id: leaderRole.id, active: true, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await admin.from('organization_users').insert({
          user_id: userId,
          organization_id: orgId,
          role_id: leaderRole.id,
          active: true,
        })
      }
    }
  }
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold text-gray-800">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input {...props} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
    </label>
  )
}

function Select({ label, name, options }: { label: string; name: string; options: Array<[string, string]> }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <select name={name} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
        <option value="">Selecionar...</option>
        {options.map(([value, labelText]) => <option key={`${name}-${value}`} value={value}>{labelText}</option>)}
      </select>
    </label>
  )
}
