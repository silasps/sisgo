import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getRolePreview } from '@/lib/role-preview'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { isManagementRole, isOperationalManager, MANUTENCAO_ROLES, userHasAnyRole } from '@/lib/auth/permissions'
import { SolicitacoesHub, type DeptInfo, type RequestItem } from './SolicitacoesHub'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ msg?: string }>
}

export default async function SolicitacoesPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { msg } = await searchParams

  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id, role_accumulations').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name), extra_roles')
    .eq('user_id', user.id)
    .eq('active', true)

  const rows = (orgUsers ?? []) as unknown as Array<{
    organization_id: string | null
    roles: { name: string } | null
    extra_roles?: string[] | null
  }>
  const superadminRow = rows.find(r => r.roles?.name === 'superadmin')
  const currentOrgRow = rows.find(r => r.organization_id === org.id)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  if (!realRole) redirect('/login')

  const preview = await getRolePreview(realRole)
  const role = preview?.role ?? realRole
  const orgAccumulations = (org.role_accumulations as Record<string, string[]> | null) ?? {}
  const accRoles = [...(orgAccumulations[role] ?? []), ...((currentOrgRow?.extra_roles as string[] | null) ?? [])]
  const allRoles = [role, ...accRoles]

  const isManagement = isManagementRole(role)
  const canWrite = isOperationalManager(role)
  const isHospitalidade = allRoles.includes('hospitalidade')
  const isManutencao = allRoles.includes('manutencao')
  const isSecretaria = allRoles.includes('secretaria')
  const isDeptRole = isHospitalidade || isManutencao || isSecretaria

  const resolverDepts = new Set<string>()
  if (canWrite) {
    ;['hospitalidade', 'manutencao', 'secretaria', 'dh', 'outro'].forEach(d => resolverDepts.add(d))
  } else {
    if (isHospitalidade) resolverDepts.add('hospitalidade')
    if (isManutencao) resolverDepts.add('manutencao')
    if (isSecretaria) resolverDepts.add('secretaria')
  }

  const visibleDeptIds = ['hospitalidade', 'manutencao', 'secretaria', 'dh', 'outro']

  const baseQuery = (isManagement ? sbAdmin : supabase)
    .from('service_requests')
    .select('id, request_type, subject, description, priority, location_notes, status, created_at, target_department, requester_id, assigned_to, redirected_from')
    .eq('organization_id', org.id)
    .in('target_department', visibleDeptIds)
    .order('created_at', { ascending: false })

  const { data: rawRequests } = (!isManagement && !isDeptRole)
    ? await baseQuery.eq('requester_id', user.id)
    : await baseQuery

  let nameMap = new Map<string, string>()
  if (isManagement || isDeptRole) {
    const userIds = new Set<string>()
    for (const r of (rawRequests ?? []) as Array<{ requester_id: string; assigned_to: string | null }>) {
      userIds.add(r.requester_id)
      if (r.assigned_to) userIds.add(r.assigned_to)
    }
    if (userIds.size > 0) {
      const { data: people } = await sbAdmin
        .from('people')
        .select('user_id, full_name')
        .in('user_id', [...userIds])
      nameMap = new Map(
        (people ?? []).map((p: { user_id: string | null; full_name: string }) => [p.user_id ?? '', p.full_name])
      )
    }
  }

  const requests: RequestItem[] = (rawRequests ?? []).map((r: {
    id: string; request_type: string; subject: string; description: string | null
    priority: string | null; location_notes: string | null; status: string
    created_at: string; target_department: string; requester_id: string
    assigned_to: string | null; redirected_from: string | null
  }) => ({
    id: r.id,
    request_type: r.request_type,
    subject: r.subject,
    description: r.description,
    priority: r.priority ?? 'normal',
    location_notes: r.location_notes,
    status: r.status,
    created_at: r.created_at,
    target_department: r.target_department,
    requesterName: nameMap.get(r.requester_id) ?? null,
    assignedToName: r.assigned_to ? (nameMap.get(r.assigned_to) ?? null) : null,
    redirected_from: r.redirected_from,
  }))

  const openCounts = new Map<string, number>()
  for (const r of requests) {
    if (['pendente', 'em_analise', 'em_andamento'].includes(r.status)) {
      openCounts.set(r.target_department, (openCounts.get(r.target_department) ?? 0) + 1)
    }
  }

  const deptInfos: DeptInfo[] = visibleDeptIds.map(id => ({
    id,
    openCount: openCounts.get(id) ?? 0,
    canResolve: resolverDepts.has(id),
    canRedirect: canWrite,
    showEstoqueLink: id === 'manutencao' && userHasAnyRole(allRoles, MANUTENCAO_ROLES),
    slug,
  }))

  // ── Server Actions ──────────────────────────────────────────────────────────

  const handleCreate = async (formData: FormData) => {
    'use server'
    const target_department = String(formData.get('target_department') ?? '').trim()
    const request_type      = String(formData.get('request_type') ?? '').trim()
    const subject           = String(formData.get('subject') ?? '').trim()
    const description       = String(formData.get('description') ?? '').trim() || null
    const priority          = String(formData.get('priority') ?? 'normal')
    const location_notes    = String(formData.get('location_notes') ?? '').trim() || null
    if (!target_department || !request_type || !subject) return

    const { data: { user: u } } = await (await createClient()).auth.getUser()
    if (!u) return

    const { data: ou } = await (await createClient())
      .from('organization_users')
      .select('roles(name)')
      .eq('user_id', u.id)
      .eq('organization_id', org.id)
      .eq('active', true)
      .maybeSingle() as { data: { roles: { name: string } | null } | null }
    const requesterRole = (ou as { roles?: { name: string } | null } | null)?.roles?.name ?? 'membro'

    await createAdminClient().from('service_requests').insert({
      organization_id: org.id,
      requester_id: u.id,
      requester_role: requesterRole,
      target_department,
      request_type,
      subject,
      description,
      priority,
      location_notes,
      status: 'pendente',
    })
    redirect(`/${slug}/manutencao?msg=criado`)
  }

  const handleStatus = async (formData: FormData) => {
    'use server'
    const id     = String(formData.get('id') ?? '')
    const status = String(formData.get('status') ?? '')
    const { data: { user: u } } = await (await createClient()).auth.getUser()
    if (!u || !id || !status) return
    await createAdminClient().from('service_requests').update({
      status,
      reviewed_by: u.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    revalidatePath(`/${slug}/manutencao`)
  }

  const handleAssign = async (formData: FormData) => {
    'use server'
    const id = String(formData.get('id') ?? '')
    const { data: { user: u } } = await (await createClient()).auth.getUser()
    if (!u || !id) return
    await createAdminClient().from('service_requests').update({
      assigned_to: u.id,
      status: 'em_analise',
      reviewed_by: u.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    revalidatePath(`/${slug}/manutencao`)
  }

  const handleRedirect = async (formData: FormData) => {
    'use server'
    const id = String(formData.get('id') ?? '')
    const newDept = String(formData.get('new_department') ?? '')
    const { data: { user: u } } = await (await createClient()).auth.getUser()
    if (!u || !id || !newDept) return

    const sb = createAdminClient()
    const { data: req } = await sb.from('service_requests')
      .select('target_department')
      .eq('id', id)
      .single()
    if (!req) return

    await sb.from('service_requests').update({
      target_department: newDept,
      redirected_from: req.target_department,
      reviewed_by: u.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    revalidatePath(`/${slug}/manutencao`)
  }

  const successMsg = msg === 'criado' ? 'Solicitação enviada com sucesso!' : undefined

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Solicitações de Serviço" />
      <div className="flex-1 px-4 pb-8 pt-4 max-w-5xl mx-auto w-full">
        <SolicitacoesHub
          deptInfos={deptInfos}
          requests={requests}
          handleCreate={handleCreate}
          handleStatus={handleStatus}
          handleAssign={handleAssign}
          handleRedirect={handleRedirect}
          successMsg={successMsg}
        />
      </div>
    </div>
  )
}
