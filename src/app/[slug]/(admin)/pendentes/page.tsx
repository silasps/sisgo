import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { DonutChart } from '@/components/ui/DonutChart'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { updateServiceStatus, cancelRequest } from '../ministerios/[id]/actions'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ msg?: string }>
}

const MANAGEMENT_ROLES = ['superadmin', 'admin_base', 'lider_base', 'dh']

type PendenteItem = {
  id: string
  categoria: string
  nome: string
  escola: string | null
  status: string
  statusLabel: string
  statusColor: string
  criadoEm: string
  diasAberto: number
  linkDestino: string
  overflow: boolean
  overflowEscola?: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente:           { label: 'Pendente',      color: 'bg-yellow-100 text-yellow-700' },
  formulario_enviado: { label: 'Form. enviado',  color: 'bg-blue-100 text-blue-700' },
  em_contato:         { label: 'Em contato',    color: 'bg-purple-100 text-purple-700' },
  em_analise:         { label: 'Em análise',    color: 'bg-blue-100 text-blue-700' },
}

const SERVICE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente:   { label: 'Pendente',     color: 'bg-yellow-100 text-yellow-700' },
  em_analise: { label: 'Em análise',   color: 'bg-blue-100 text-blue-700' },
  resolvido:  { label: 'Resolvido',    color: 'bg-green-100 text-green-700' },
  rejeitado:  { label: 'Rejeitado',    color: 'bg-red-100 text-red-700' },
}

const REQUEST_LABELS: Record<string, string> = {
  add_member:    'Adicionar membro',
  remove_member: 'Remover membro',
  change_role:   'Alterar papel',
}

function urgencyBadge(dias: number): { label: string; color: string } {
  if (dias === 0) return { label: 'Hoje', color: 'bg-green-100 text-green-700' }
  if (dias === 1) return { label: '1d',   color: 'bg-green-100 text-green-700' }
  if (dias === 2) return { label: '2d',   color: 'bg-yellow-100 text-yellow-700' }
  if (dias === 3) return { label: '3d',   color: 'bg-orange-100 text-orange-700' }
  return              { label: `${dias}d`, color: 'bg-red-100 text-red-700' }
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

export default async function PendentesPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { msg } = await searchParams
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, department_assignments')
    .eq('slug', slug)
    .single()
  const orgId = org?.id ?? ''
  // Mapa departamento → papel responsável (padrão: hospitalidade → 'hospitalidade')
  const deptAssignments = (org?.department_assignments as Record<string, string> | null)
    ?? { hospitalidade: 'hospitalidade', secretaria: 'secretaria' }

  const { data: { user } } = await supabase.auth.getUser()
  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name), user_id')
    .eq('user_id', user?.id ?? '')
    .eq('active', true)
    .single()

  const role = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''
  const isManagement       = MANAGEMENT_ROLES.includes(role)
  const isLiderEted        = role === 'lider_eted'
  const isLiderMinisterio  = role === 'lider_ministerio'

  // Departamentos pelos quais este usuário é responsável (via department_assignments)
  const myDepts = Object.entries(deptAssignments)
    .filter(([, assignedRole]) => assignedRole === role)
    .map(([dept]) => dept)
  const isHospitalidade = role === 'hospitalidade' || myDepts.includes('hospitalidade')

  // ── Ministério do lider_ministerio ─────────────────────────────────────────
  let liderMinisterioMinistrioId: string | null = null
  let liderMinisterioMinistrioNome: string | null = null
  if (isLiderMinisterio && user) {
    const { data: lm } = await supabase
      .from('ministry_leaders')
      .select('ministry_id, ministries(name)')
      .eq('user_id', user.id)
      .single()
    if (lm) {
      liderMinisterioMinistrioId   = lm.ministry_id
      liderMinisterioMinistrioNome = (lm.ministries as unknown as { name: string } | null)?.name ?? null
    }
  }

  // ── Escola(s) do lider_eted ─────────────────────────────────────────────────
  let liderEtedSchoolIds: string[] = []
  if (isLiderEted && user) {
    const { data: leaderRows } = await supabase
      .from('school_leaders')
      .select('school_id')
      .eq('user_id', user.id)
    liderEtedSchoolIds = (leaderRows ?? []).map(r => r.school_id)
  }

  const items: PendenteItem[] = []

  // ── 1. Pré-inscrições ────────────────────────────────────────────────────────
  if (isManagement || isLiderEted) {
    const sbAdmin = createAdminClient()
    type InterestRaw = {
      id: string; full_name: string; status: string; created_at: string
      schools: { id: string; name: string } | null
      school_classes: { name: string } | null
    }

    const { data: interests } = await sbAdmin
      .from('school_interest_forms')
      .select('id, full_name, status, created_at, schools(id, name), school_classes(name)')
      .eq('organization_id', orgId)
      .not('status', 'in', '("convertido","descartado")')
      .order('created_at', { ascending: true })

    for (const r of ((interests ?? []) as unknown as InterestRaw[])) {
      const escola = r.schools as { id: string; name: string } | null
      const turma  = r.school_classes as { name: string } | null
      const dias   = daysAgo(r.created_at)
      const schoolId = escola?.id

      if (isLiderEted) {
        const isOwner    = schoolId ? liderEtedSchoolIds.includes(schoolId) : false
        const isOverflow = !isOwner && dias >= 3 && r.status === 'pendente'
        if (!isOwner && !isOverflow) continue
      }

      const isOverflow = isLiderEted && schoolId ? !liderEtedSchoolIds.includes(schoolId) : false
      const statusInfo = STATUS_LABELS[r.status] ?? { label: r.status, color: 'bg-gray-100 text-gray-500' }
      items.push({
        id: r.id, categoria: 'Pré-inscrição', nome: r.full_name, overflow: isOverflow,
        escola: escola ? `${escola.name}${turma?.name ? ` · ${turma.name}` : ''}` : null,
        status: r.status, statusLabel: statusInfo.label, statusColor: statusInfo.color,
        criadoEm: r.created_at, diasAberto: dias, linkDestino: `/${slug}/inscricoes`,
        overflowEscola: isOverflow ? (escola?.name ?? undefined) : undefined,
      })
    }
  }

  // ── 2. Candidatos a Alunos ──────────────────────────────────────────────────
  if (isManagement || isLiderEted) {
    type StudentAppRaw = {
      id: string; status: string; applied_at: string
      people: { full_name: string } | null
      schools: { id: string; name: string } | null
    }
    const { data: studentApps } = await supabase
      .from('student_applications')
      .select('id, status, applied_at, people(full_name), schools(id, name)')
      .eq('organization_id', orgId)
      .in('status', ['pendente', 'em_analise'])
      .order('applied_at', { ascending: true })

    for (const r of ((studentApps ?? []) as unknown as StudentAppRaw[])) {
      if (isLiderEted) {
        const schoolId = (r.schools as { id: string } | null)?.id
        if (!schoolId || !liderEtedSchoolIds.includes(schoolId)) continue
      }
      const statusInfo = STATUS_LABELS[r.status] ?? { label: r.status, color: 'bg-gray-100 text-gray-500' }
      items.push({
        id: r.id, categoria: 'Candidato a Aluno', overflow: false,
        nome: r.people?.full_name ?? '—',
        escola: (r.schools as { name: string } | null)?.name ?? null,
        status: r.status, statusLabel: statusInfo.label, statusColor: statusInfo.color,
        criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
        linkDestino: `/${slug}/pessoas?tab=alunos`,
      })
    }
  }

  // ── 3. Candidatos a Obreiros (gestão) ───────────────────────────────────────
  if (isManagement) {
    type StaffAppRaw = {
      id: string; status: string; applied_at: string
      people: { full_name: string } | null
    }
    const { data: staffApps } = await supabase
      .from('staff_applications')
      .select('id, status, applied_at, people(full_name)')
      .eq('organization_id', orgId)
      .in('status', ['pendente', 'em_analise'])
      .order('applied_at', { ascending: true })

    for (const r of ((staffApps ?? []) as unknown as StaffAppRaw[])) {
      const statusInfo = STATUS_LABELS[r.status] ?? { label: r.status, color: 'bg-gray-100 text-gray-500' }
      items.push({
        id: r.id, categoria: 'Candidato a Obreiro', overflow: false,
        nome: r.people?.full_name ?? '—', escola: null,
        status: r.status, statusLabel: statusInfo.label, statusColor: statusInfo.color,
        criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
        linkDestino: `/${slug}/pessoas?tab=obreiros`,
      })
    }
  }

  items.sort((a, b) => b.diasAberto - a.diasAberto)
  const totalUrgentes = items.filter(i => i.diasAberto >= 3).length

  // ── 4. Solicitações de ministério (gestão) ──────────────────────────────────
  type MinistryReqRaw = {
    id: string; request_type: string; notes: string | null; created_at: string
    ministry_id: string
    person_id: string | null
    ministries: { name: string } | null
    people: { full_name: string } | null
    ministry_roles: { name: string } | null
  }
  let ministryRequests: MinistryReqRaw[] = []
  if (isManagement) {
    const { data } = await supabase
      .from('ministry_pending_requests')
      .select('id, request_type, notes, created_at, ministry_id, person_id, ministries(name), people(full_name), ministry_roles(name)')
      .eq('organization_id', orgId)
      .eq('status', 'pendente')
      .order('created_at', { ascending: true })
    ministryRequests = (data ?? []) as unknown as MinistryReqRaw[]
  }

  // ── 5. Solicitações de serviço ───────────────────────────────────────────────
  type ServiceReqRaw = {
    id: string; subject: string; request_type: string; target_department: string
    description: string | null; status: string; created_at: string; requester_role: string
  }
  let serviceRequests: ServiceReqRaw[] = []
  if (isManagement || isHospitalidade) {
    const sbAdmin = createAdminClient()
    let q = sbAdmin
      .from('service_requests')
      .select('id, subject, request_type, target_department, description, status, created_at, requester_role')
      .eq('organization_id', orgId)
      .in('status', ['pendente', 'em_analise'])
      .order('created_at', { ascending: true })
    if (!isManagement) q = q.in('target_department', myDepts.length > 0 ? myDepts : ['hospitalidade'])
    const { data } = await q
    serviceRequests = (data ?? []) as unknown as ServiceReqRaw[]
  }

  // ── 6. Visão lider_ministerio: suas solicitações abertas ────────────────────
  type LeaderReqRaw = {
    id: string; request_type: string; notes: string | null; created_at: string; status: string
    person_id: string | null
    people: { full_name: string } | null
    ministry_roles: { name: string } | null
  }
  let myMinistryRequests: LeaderReqRaw[] = []
  let myServiceRequests: ServiceReqRaw[] = []
  if (isLiderMinisterio && user && liderMinisterioMinistrioId) {
    const [{ data: mr }, { data: sr }] = await Promise.all([
      supabase.from('ministry_pending_requests')
        .select('id, request_type, notes, created_at, status, person_id, people(full_name), ministry_roles(name)')
        .eq('ministry_id', liderMinisterioMinistrioId)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false }),
      supabase.from('service_requests')
        .select('id, subject, request_type, target_department, description, status, created_at, requester_role')
        .eq('organization_id', orgId)
        .eq('requester_id', user.id)
        .not('status', 'in', '("resolvido","rejeitado")')
        .order('created_at', { ascending: false }),
    ])
    myMinistryRequests = (mr ?? []) as unknown as LeaderReqRaw[]
    myServiceRequests  = (sr ?? []) as unknown as ServiceReqRaw[]
  }

  // ── Server actions inline ───────────────────────────────────────────────────
  const handleServiceStatusUpdate = async (formData: FormData) => {
    'use server'
    await updateServiceStatus(formData.get('request_id') as string, formData.get('status') as string)
    redirect(`/${slug}/pendentes`)
  }

  const handleCancelMinistryRequest = async (formData: FormData) => {
    'use server'
    await cancelRequest(formData.get('request_id') as string)
    redirect(`/${slug}/pendentes`)
  }

  // Solicitação de serviço pelo lider_eted (formulário simples)
  const handleServiceRequestFromEted = async (formData: FormData) => {
    'use server'
    const subject = (formData.get('subject') as string).trim()
    if (!subject || !user) return
    const sbAdmin = createAdminClient()
    await sbAdmin.from('service_requests').insert({
      organization_id: orgId,
      requester_id: user.id,
      requester_role: role,
      target_department: formData.get('target_department') as 'hospitalidade' | 'dh' | 'secretaria' | 'outro',
      request_type: formData.get('request_type') as string,
      subject,
      description: (formData.get('description') as string) || null,
    })
    redirect(`/${slug}/pendentes?msg=servico_enviado`)
  }

  // ── Gráficos ─────────────────────────────────────────────────────────────────
  const categoryCounts = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.categoria] = (acc[i.categoria] ?? 0) + 1; return acc
  }, {})

  const categorySegments = [
    { label: 'Pré-inscrição',       value: categoryCounts['Pré-inscrição']       ?? 0, color: '#F59E0B' },
    { label: 'Candidato a Aluno',   value: categoryCounts['Candidato a Aluno']   ?? 0, color: '#8B5CF6' },
    { label: 'Candidato a Obreiro', value: categoryCounts['Candidato a Obreiro'] ?? 0, color: '#10B981' },
  ]
  const urgencySegments = [
    { label: 'Ok (0–1 dia)',      value: items.filter(i => i.diasAberto <= 1).length, color: '#34D399' },
    { label: 'Atenção (2 dias)',  value: items.filter(i => i.diasAberto === 2).length, color: '#FBBF24' },
    { label: 'Urgente (3+ dias)', value: items.filter(i => i.diasAberto >= 3).length,  color: '#F87171' },
  ]

  const hasPendingItems = items.length > 0
  const hasMsgServico   = msg === 'servico_enviado'

  return (
    <>
      <Header
        title="Pendentes"
        actions={
          totalUrgentes > 0 ? (
            <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full">
              {totalUrgentes} urgente{totalUrgentes !== 1 ? 's' : ''}
            </span>
          ) : undefined
        }
      />
      <main className="p-4 md:p-6 space-y-4">

        {hasMsgServico && (
          <div className="border rounded-lg px-4 py-3 text-sm bg-blue-50 border-blue-200 text-blue-700">
            Solicitação de serviço enviada com sucesso.
          </div>
        )}

        {/* ════ VISÃO LIDER_MINISTERIO ════ */}
        {isLiderMinisterio && (
          <>
            {myMinistryRequests.length === 0 && myServiceRequests.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-3xl mb-3">✓</p>
                <p className="text-gray-400 text-sm">Nenhuma pendência no momento.</p>
                {liderMinisterioMinistrioId && (
                  <Link
                    href={`/${slug}/ministerios/${liderMinisterioMinistrioId}`}
                    className="mt-3 inline-block text-sm text-brand-600 hover:text-brand-800 font-medium"
                  >
                    Ir para o ministério →
                  </Link>
                )}
              </div>
            ) : (
              <>
                {/* Solicitações ao DH */}
                {myMinistryRequests.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">
                        Solicitações ao DH — {liderMinisterioMinistrioNome ?? 'Ministério'}
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                          {myMinistryRequests.length}
                        </span>
                      </h3>
                      {liderMinisterioMinistrioId && (
                        <Link
                          href={`/${slug}/ministerios/${liderMinisterioMinistrioId}`}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                        >
                          Ver ministério →
                        </Link>
                      )}
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {myMinistryRequests.map(req => {
                        const pName = (req.people as { full_name: string } | null)?.full_name
                        const rName = (req.ministry_roles as { name: string } | null)?.name
                        return (
                          <li key={req.id} className="px-4 py-3 flex items-start justify-between gap-3">
                            <div className="text-sm min-w-0">
                              <p className="font-medium text-gray-800">
                                {REQUEST_LABELS[req.request_type] ?? req.request_type}
                                {pName && ` — ${pName}`}
                                {rName && ` → ${rName}`}
                              </p>
                              {req.notes && (
                                <p className="text-xs text-gray-400 italic mt-0.5">"{req.notes}"</p>
                              )}
                              <p className="text-xs text-gray-400 mt-0.5">{daysAgo(req.created_at)}d atrás</p>
                            </div>
                            <form action={handleCancelMinistryRequest} className="flex-shrink-0">
                              <input type="hidden" name="request_id" value={req.id} />
                              <button type="submit" className="text-xs text-gray-400 hover:text-gray-700 transition-colors whitespace-nowrap">
                                Cancelar
                              </button>
                            </form>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {/* Serviços enviados */}
                {myServiceRequests.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700">
                        Serviços Solicitados
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                          {myServiceRequests.length}
                        </span>
                      </h3>
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {myServiceRequests.map(sr => {
                        const statusInfo = SERVICE_STATUS_LABELS[sr.status] ?? { label: sr.status, color: 'bg-gray-100 text-gray-500' }
                        return (
                          <li key={sr.id} className="px-4 py-3 flex items-start justify-between gap-3">
                            <div className="text-sm min-w-0">
                              <p className="font-medium text-gray-800">{sr.subject}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Para: {sr.target_department} · {sr.request_type} · {daysAgo(sr.created_at)}d atrás
                              </p>
                            </div>
                            <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ════ VISÃO HOSPITALIDADE ════ */}
        {isHospitalidade && !isManagement && (
          <>
            {serviceRequests.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-3xl mb-3">✓</p>
                <p className="text-gray-400 text-sm">Nenhum serviço solicitado no momento.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Serviços Recebidos ({serviceRequests.length})
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 w-14">Dias</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Assunto</th>
                      <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 w-28"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {serviceRequests.map(sr => {
                      const statusInfo = SERVICE_STATUS_LABELS[sr.status] ?? { label: sr.status, color: 'bg-gray-100 text-gray-500' }
                      const dias = daysAgo(sr.created_at)
                      const urg  = urgencyBadge(dias)
                      return (
                        <tr key={sr.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold ${urg.color}`}>
                              {urg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{sr.subject}</p>
                            {sr.description && (
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{sr.description}</p>
                            )}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-3 text-gray-500 text-xs">{sr.request_type}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <form action={handleServiceStatusUpdate} className="inline-flex gap-1">
                              <input type="hidden" name="request_id" value={sr.id} />
                              {sr.status === 'pendente' && (
                                <button name="status" value="em_analise" type="submit"
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                  Analisar
                                </button>
                              )}
                              {sr.status !== 'resolvido' && (
                                <button name="status" value="resolvido" type="submit"
                                  className="text-xs text-green-600 hover:text-green-800 font-medium">
                                  Resolver
                                </button>
                              )}
                            </form>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ════ VISÃO GESTÃO + LIDER_ETED ════ */}
        {(isManagement || isLiderEted) && (
          <>
            {!hasPendingItems ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-3xl mb-3">✓</p>
                <p className="text-gray-400 text-sm">Nenhuma pendência no momento.</p>
              </div>
            ) : (
              <>
                {/* Gráficos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Por categoria</h3>
                    <DonutChart segments={categorySegments} title="total" />
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Por urgência</h3>
                    <DonutChart segments={urgencySegments} title="total" />
                  </div>
                </div>

                {/* Tabela principal */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 w-14">Dias</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                        <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                        <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Escola / ETED</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 w-14"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map(item => {
                        const urgency = urgencyBadge(item.diasAberto)
                        return (
                          <tr key={`${item.categoria}-${item.id}`} className={`hover:bg-gray-50 ${item.overflow ? 'bg-orange-50/40' : ''}`}>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${urgency.color}`}>
                                {urgency.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{item.nome}</p>
                              <p className="text-xs text-gray-400 sm:hidden">{item.categoria}</p>
                              {item.overflow && (
                                <p className="text-xs text-orange-600 font-medium mt-0.5">
                                  Sem resposta em {item.overflowEscola} há {item.diasAberto}d
                                </p>
                              )}
                            </td>
                            <td className="hidden sm:table-cell px-4 py-3 text-gray-500">{item.categoria}</td>
                            <td className="hidden md:table-cell px-4 py-3 text-gray-500">
                              {item.escola ?? '—'}
                              {item.overflow && (
                                <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                                  sem resposta
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${item.statusColor}`}>
                                {item.statusLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link href={item.linkDestino} className="text-xs text-brand-500 hover:text-brand-700 font-medium">
                                Ver →
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── Seção: Solicitações de Ministério (gestão) ── */}
            {isManagement && ministryRequests.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Solicitações de Ministério
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                      {ministryRequests.length}
                    </span>
                  </h3>
                </div>
                <ul className="divide-y divide-gray-100">
                  {ministryRequests.map(req => {
                    const pName = (req.people as { full_name: string } | null)?.full_name
                    const rName = (req.ministry_roles as { name: string } | null)?.name
                    const mName = (req.ministries as { name: string } | null)?.name
                    const dias  = daysAgo(req.created_at)
                    const urg   = urgencyBadge(dias)
                    return (
                      <li key={req.id} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded-full text-xs font-bold ${urg.color}`}>
                              {urg.label}
                            </span>
                            <p className="text-sm font-medium text-gray-800">
                              {REQUEST_LABELS[req.request_type] ?? req.request_type}
                              {pName && ` — ${pName}`}
                              {rName && ` → ${rName}`}
                            </p>
                          </div>
                          <p className="text-xs text-gray-400">Ministério: {mName ?? '—'}</p>
                          {req.notes && (
                            <p className="text-xs text-gray-400 italic mt-0.5">"{req.notes}"</p>
                          )}
                        </div>
                        <Link
                          href={`/${slug}/ministerios/${req.ministry_id}`}
                          className="flex-shrink-0 text-xs text-brand-500 hover:text-brand-700 font-medium whitespace-nowrap"
                        >
                          Revisar →
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* ── Seção: Serviços recebidos (gestão + hospitalidade) ── */}
            {(isManagement || isHospitalidade) && serviceRequests.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Serviços Recebidos
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                      {serviceRequests.length}
                    </span>
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs w-14">Dias</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Assunto</th>
                      <th className="hidden sm:table-cell text-left px-4 py-2 font-medium text-gray-500 text-xs">Destino</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Status</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-500 text-xs w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {serviceRequests.map(sr => {
                      const statusInfo = SERVICE_STATUS_LABELS[sr.status] ?? { label: sr.status, color: 'bg-gray-100 text-gray-500' }
                      const dias = daysAgo(sr.created_at)
                      const urg  = urgencyBadge(dias)
                      return (
                        <tr key={sr.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded-full text-xs font-bold ${urg.color}`}>
                              {urg.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900 text-sm">{sr.subject}</p>
                            <p className="text-xs text-gray-400">{sr.requester_role} · {sr.request_type}</p>
                          </td>
                          <td className="hidden sm:table-cell px-4 py-2.5 text-gray-500 text-xs">{sr.target_department}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <form action={handleServiceStatusUpdate} className="inline-flex gap-2">
                              <input type="hidden" name="request_id" value={sr.id} />
                              {sr.status === 'pendente' && (
                                <button name="status" value="em_analise" type="submit"
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                  Analisar
                                </button>
                              )}
                              <button name="status" value="resolvido" type="submit"
                                className="text-xs text-green-600 hover:text-green-800 font-medium">
                                Resolver
                              </button>
                            </form>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Formulário: Nova solicitação de serviço (lider_eted) ── */}
            {isLiderEted && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Nova Solicitação de Serviço</h3>
                <p className="text-xs text-gray-400 mb-3">
                  Para convidar professor, solicitar hospedagem ou outro suporte da base.
                </p>
                <form action={handleServiceRequestFromEted} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Destino</label>
                      <select name="target_department" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                        <option value="hospitalidade">Hospitalidade</option>
                        <option value="dh">DH</option>
                        <option value="secretaria">Secretaria</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                      <select name="request_type" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                        <option value="convidar_professor">Convidar professor</option>
                        <option value="hospedagem">Hospedagem</option>
                        <option value="logistica">Logística</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Assunto <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="subject" required placeholder="Resumo da solicitação..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
                    <textarea
                      name="description" rows={2} placeholder="Detalhes adicionais..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
                  >
                    Enviar Solicitação
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
