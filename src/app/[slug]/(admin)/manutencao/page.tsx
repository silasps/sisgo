import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getRolePreview } from '@/lib/role-preview'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { isManagementRole, MANUTENCAO_ROLES, userHasAnyRole } from '@/lib/auth/permissions'
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
  const isHospitalidade = allRoles.includes('hospitalidade')
  const isManutencao = allRoles.includes('manutencao')
  const isSecretaria = allRoles.includes('secretaria')
  const isDeptRole = isHospitalidade || isManutencao || isSecretaria

  // Quem pode resolver qual departamento
  const resolverDepts = new Set<string>()
  if (isManagement) {
    ;['hospitalidade', 'manutencao', 'secretaria', 'dh', 'outro'].forEach(d => resolverDepts.add(d))
  } else {
    if (isHospitalidade) resolverDepts.add('hospitalidade')
    if (isManutencao) resolverDepts.add('manutencao')
    if (isSecretaria) resolverDepts.add('secretaria')
  }

  // Quais departamentos são visíveis
  let visibleDeptIds: string[]
  if (isManagement || !isDeptRole) {
    visibleDeptIds = ['hospitalidade', 'manutencao', 'secretaria', 'dh', 'outro']
  } else {
    visibleDeptIds = [...resolverDepts]
  }

  // Buscar solicitações
  const baseQuery = (isManagement ? sbAdmin : supabase)
    .from('service_requests')
    .select('id, request_type, subject, description, priority, location_notes, status, created_at, target_department, requester_id')
    .eq('organization_id', org.id)
    .in('target_department', visibleDeptIds)
    .order('created_at', { ascending: false })

  // Papel não gestor e não deptRole vê apenas as próprias
  const { data: rawRequests } = (!isManagement && !isDeptRole)
    ? await baseQuery.eq('requester_id', user.id)
    : await baseQuery

  // Nomes dos solicitantes para gestão/dept
  let nameMap = new Map<string, string>()
  if (isManagement || isDeptRole) {
    const ids = [...new Set((rawRequests ?? []).map((r: { requester_id: string }) => r.requester_id))]
    if (ids.length > 0) {
      const { data: people } = await sbAdmin
        .from('people')
        .select('user_id, full_name')
        .in('user_id', ids)
      nameMap = new Map(
        (people ?? []).map((p: { user_id: string | null; full_name: string }) => [p.user_id ?? '', p.full_name])
      )
    }
  }

  const requests: RequestItem[] = (rawRequests ?? []).map((r: {
    id: string; request_type: string; subject: string; description: string | null
    priority: string | null; location_notes: string | null; status: string
    created_at: string; target_department: string; requester_id: string
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
  }))

  // Contagens abertas por departamento
  const openCounts = new Map<string, number>()
  for (const r of requests) {
    if (['pendente', 'em_analise'].includes(r.status)) {
      openCounts.set(r.target_department, (openCounts.get(r.target_department) ?? 0) + 1)
    }
  }

  const deptInfos: DeptInfo[] = visibleDeptIds.map(id => ({
    id,
    openCount: openCounts.get(id) ?? 0,
    canResolve: resolverDepts.has(id),
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
    await (await createClient()).from('service_requests').update({
      status,
      reviewed_by: u.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    revalidatePath(`/${slug}/manutencao`)
  }

  const successMsg = msg === 'criado' ? 'Solicitação enviada com sucesso!' : undefined

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Solicitações de Serviço" mobileHeight="dashboard" />
      <div className="flex-1 px-4 pb-8 pt-4 max-w-5xl mx-auto w-full">
        <SolicitacoesHub
          deptInfos={deptInfos}
          requests={requests}
          handleCreate={handleCreate}
          handleStatus={handleStatus}
          successMsg={successMsg}
        />
      </div>
    </div>
  )
}
