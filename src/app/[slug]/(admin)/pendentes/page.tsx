import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { AnimatedDonutChart } from '@/components/ui/AnimatedDonutChart'
import { redirect } from 'next/navigation'
import { updateServiceStatus, cancelRequest } from '../ministerios/[id]/actions'
import { confirmMealPayment, rejectMealPayment, requestMealPaymentProof } from '../cozinha/actions'
import { getRolePreview } from '@/lib/role-preview'
import { isManagementRole, isOperationalManager } from '@/lib/auth/permissions'
import { ServiceRequestsPanel } from './ServiceRequestsPanel'
import { PendentesCardList } from './PendentesCardList'
import { SearchBar } from '@/components/ui/SearchBar'
import { Suspense } from 'react'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string }>
}

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
  email?: string | null
  phone?: string | null
  turma?: string | null
  mensagem?: string | null
  ministryName?: string | null
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

function whatsappDigits(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.length >= 12 && digits.length <= 15) return digits
  return null
}

function WhatsAppButton({ phone, label = 'WhatsApp' }: { phone?: string | null; label?: string }) {
  const digits = whatsappDigits(phone)
  if (!digits) {
    return (
      <span className="inline-flex cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-400">
        {label}
      </span>
    )
  }
  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
    >
      {label}
    </a>
  )
}

export default async function PendentesPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { q } = await searchParams
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

  const realRole = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''
  const preview = await getRolePreview(realRole)
  const role = preview?.role ?? realRole
  const isPreview = Boolean(preview)
  const isManagement       = isManagementRole(role)
  const canWrite           = isOperationalManager(role)
  const isSecretaria       = role === 'secretaria'
  const isLiderEted        = role === 'lider_eted'
  const isLiderMinisterio  = role === 'lider_ministerio'
  const canBuyMeals        = Boolean(role)

  // Departamentos pelos quais este usuário é responsável (via department_assignments)
  const myDepts = Object.entries(deptAssignments)
    .filter(([, assignedRole]) => assignedRole === role)
    .map(([dept]) => dept)
  const isHospitalidade = role === 'hospitalidade' || myDepts.includes('hospitalidade')
  const seesDepartmentServices = myDepts.length > 0

  // ── Ministério do lider_ministerio ─────────────────────────────────────────
  let liderMinisterioMinistrioId: string | null = null
  let liderMinisterioMinistrioNome: string | null = null
  if (isLiderMinisterio && user) {
    const { data: lm } = preview?.ministryId
      ? await supabase
        .from('ministries')
        .select('id, name')
        .eq('id', preview.ministryId)
        .single()
        .then(result => ({ data: result.data ? { ministry_id: result.data.id, ministries: { name: result.data.name } } : null }))
      : await supabase
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
    const leaderRows = preview?.schoolId
      ? [{ school_id: preview.schoolId }]
      : (await supabase
        .from('school_leaders')
        .select('school_id')
        .eq('user_id', user.id)).data
    liderEtedSchoolIds = (leaderRows ?? []).map(r => r.school_id)
  }

  const items: PendenteItem[] = []

  // ── 1. Pré-inscrições ────────────────────────────────────────────────────────
  if (isManagement || isLiderEted) {
    const sbAdmin = createAdminClient()
    type InterestRaw = {
      id: string; full_name: string; email: string | null; phone: string | null
      message: string | null; status: string; created_at: string
      schools: { id: string; name: string } | null
      school_classes: { name: string } | null
    }

    const { data: interests } = await sbAdmin
      .from('school_interest_forms')
      .select('id, full_name, email, phone, message, status, created_at, schools(id, name), school_classes(name)')
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
        email: r.email, phone: r.phone, mensagem: r.message,
        turma: turma?.name ?? null,
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
        status: r.status,
        statusLabel: r.status === 'em_analise' ? 'Obreiro sem cadastro' : statusInfo.label,
        statusColor: r.status === 'em_analise' ? 'bg-amber-100 text-amber-700' : statusInfo.color,
        criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
        linkDestino: `/${slug}/inscricoes?tab=obreiro`,
      })
    }
  }

  items.sort((a, b) => b.diasAberto - a.diasAberto)
  const filteredItems = q
    ? items.filter(i => i.nome.toLowerCase().includes(q.toLowerCase()))
    : items
  const totalUrgentes = items.filter(i => i.diasAberto >= 3).length

  // ── 4. Solicitações de ministério (gestão) ──────────────────────────────────
  type MinistryReqRaw = {
    id: string; request_type: string; notes: string | null; created_at: string
    ministry_id: string; requested_by: string
    person_id: string | null
    ministries: { name: string } | null
    people: { full_name: string } | null
    ministry_roles: { name: string } | null
  }
  // ── 4b. Solicitações de escola (gestão) — mesmo tratamento das de ministério ─
  type SchoolReqRaw = {
    id: string; role: string; notes: string | null; created_at: string
    school_id: string; requested_by: string
    person_id: string | null
    schools: { name: string } | null
    people: { full_name: string } | null
  }
  let ministryRequests: MinistryReqRaw[] = []
  let schoolRequests: SchoolReqRaw[] = []
  if (isManagement) {
    const [{ data: mrData }, { data: srData }] = await Promise.all([
      supabase
        .from('ministry_pending_requests')
        .select('id, request_type, notes, created_at, ministry_id, requested_by, person_id, ministries(name), people(full_name), ministry_roles(name)')
        .eq('organization_id', orgId)
        .eq('status', 'pendente')
        .order('created_at', { ascending: true }),
      supabase
        .from('school_pending_requests')
        .select('id, role, notes, created_at, school_id, requested_by, person_id, schools(name), people(full_name)')
        .eq('organization_id', orgId)
        .eq('status', 'pendente')
        .order('created_at', { ascending: true }),
    ])
    ministryRequests = (mrData ?? []) as unknown as MinistryReqRaw[]
    schoolRequests = (srData ?? []) as unknown as SchoolReqRaw[]
  }

  // ── 5. Solicitações de serviço ───────────────────────────────────────────────
  type ServiceReqRaw = {
    id: string; subject: string; request_type: string; target_department: string
    description: string | null; status: string; created_at: string; requester_role: string; requester_id: string
    requested_arrival_date: string | null; requested_departure_date: string | null
    staff_application_id: string | null; school_application_id: string | null
  }
  let serviceRequests: ServiceReqRaw[] = []
  if (isManagement || isHospitalidade || seesDepartmentServices) {
    const sbAdmin = createAdminClient()
    let q = sbAdmin
      .from('service_requests')
      .select('id, subject, request_type, target_department, description, status, created_at, requester_role, requester_id, requested_arrival_date, requested_departure_date, staff_application_id, school_application_id')
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
    requested_by: string; person_id: string | null
    people: { full_name: string } | null
    ministry_roles: { name: string } | null
  }
  let myMinistryRequests: LeaderReqRaw[] = []
  let myServiceRequests: ServiceReqRaw[] = []
  let myStaffApplications: Array<{ id: string; applied_at: string; people: { full_name: string } | null }> = []
  if (isLiderMinisterio && user && liderMinisterioMinistrioId) {
    const [{ data: mr }, { data: sr }, { data: staffApps }] = await Promise.all([
      supabase.from('ministry_pending_requests')
        .select('id, request_type, notes, created_at, status, requested_by, person_id, people(full_name), ministry_roles(name)')
        .eq('ministry_id', liderMinisterioMinistrioId)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false }),
      supabase.from('service_requests')
        .select('id, subject, request_type, target_department, description, status, created_at, requester_role, requester_id, requested_arrival_date, requested_departure_date, staff_application_id, school_application_id')
        .eq('organization_id', orgId)
        .eq('requester_id', user.id)
        .not('status', 'in', '("resolvido","rejeitado")')
        .order('created_at', { ascending: false }),
      supabase.from('staff_applications')
        .select('id, applied_at, people(full_name)')
        .eq('organization_id', orgId)
        .eq('ministry_id', liderMinisterioMinistrioId)
        .eq('status', 'pendente')
        .order('applied_at', { ascending: false }),
    ])
    myMinistryRequests = (mr ?? []) as unknown as LeaderReqRaw[]
    myServiceRequests  = (sr ?? []) as unknown as ServiceReqRaw[]
    myStaffApplications = (staffApps ?? []) as unknown as Array<{ id: string; applied_at: string; people: { full_name: string } | null }>
  }

  const requesterIds = [...new Set([
    ...serviceRequests.map(request => request.requester_id),
    ...ministryRequests.map(request => request.requested_by),
    ...myMinistryRequests.map(request => request.requested_by),
    ...schoolRequests.map(request => request.requested_by),
  ].filter(Boolean))]
  const requesterMap = new Map<string, { name: string; email: string; phone: string | null }>()
  const userEmails = new Map<string, string>()
  for (const requesterId of requesterIds) {
    const { data } = await createAdminClient().auth.admin.getUserById(requesterId)
    const email = data.user?.email ?? '—'
    if (data.user?.email) userEmails.set(requesterId, data.user.email)
    if (data.user) {
      requesterMap.set(requesterId, {
        name: (data.user.user_metadata?.full_name as string | undefined)
          ?? (data.user.user_metadata?.name as string | undefined)
          ?? data.user.email
          ?? 'Solicitante',
        email,
        phone: null,
      })
    }
  }
  const contactByUserId = new Map<string, string | null>()
  if (requesterIds.length > 0) {
    const sbAdmin = createAdminClient()
    const { data: staffProfiles } = await sbAdmin
      .from('staff_profiles')
      .select('user_id, person_id')
      .eq('organization_id', orgId)
      .in('user_id', requesterIds)
    const personByUser = new Map<string, string>()
    for (const row of (staffProfiles ?? []) as Array<{ user_id: string | null; person_id: string }>) {
      if (row.user_id) personByUser.set(row.user_id, row.person_id)
    }

    const missingUserIds = requesterIds.filter(id => !personByUser.has(id) && userEmails.get(id))
    if (missingUserIds.length > 0) {
      const { data: emailContacts } = await sbAdmin
        .from('person_contacts')
        .select('person_id, value')
        .eq('type', 'email')
        .in('value', missingUserIds.map(id => userEmails.get(id) as string))
      const userByEmail = new Map([...userEmails.entries()].map(([id, email]) => [email.toLowerCase(), id]))
      for (const contact of (emailContacts ?? []) as Array<{ person_id: string; value: string }>) {
        const userId = userByEmail.get(contact.value.toLowerCase())
        if (userId && !personByUser.has(userId)) personByUser.set(userId, contact.person_id)
      }
    }

    const personIds = [...new Set([...personByUser.values()])]
    if (personIds.length > 0) {
      const { data: phoneContacts } = await sbAdmin
        .from('person_contacts')
        .select('person_id, type, value, is_primary')
        .in('person_id', personIds)
        .in('type', ['whatsapp', 'phone'])
      const contactsByPerson = new Map<string, Array<{ type: string; value: string; is_primary: boolean }>>()
      for (const contact of (phoneContacts ?? []) as Array<{ person_id: string; type: string; value: string; is_primary: boolean }>) {
        const list = contactsByPerson.get(contact.person_id) ?? []
        list.push(contact)
        contactsByPerson.set(contact.person_id, list)
      }
      for (const [userId, personId] of personByUser.entries()) {
        const contacts = contactsByPerson.get(personId) ?? []
        const chosen = contacts.find(c => c.type === 'whatsapp' && c.is_primary)
          ?? contacts.find(c => c.type === 'whatsapp')
          ?? contacts.find(c => c.type === 'phone' && c.is_primary)
          ?? contacts.find(c => c.type === 'phone')
        contactByUserId.set(userId, chosen?.value ?? null)
      }
    }
    for (const userId of requesterIds) {
      const current = requesterMap.get(userId)
      if (current) requesterMap.set(userId, { ...current, phone: contactByUserId.get(userId) ?? null })
    }
  }

  type MealPendingRow = {
    purchase_group_id: string
    requested_by: string | null
    consumer_name: string
    meal_date: string
    selected_meals: string[] | null
    final_amount: number | null
    notes: string | null
    created_at: string
    payment_proof_path: string | null
    payment_proof_name: string | null
    payment_proof_uploaded_at: string | null
    payment_proof_requested_at: string | null
    payment_proof_request_message: string | null
  }
  let pendingMealOrders: Array<{
    purchase_group_id: string
    requestedBy: string | null
    consumer_name: string
    dates: string[]
    meals: string[]
    total: number
    notes: string | null
    created_at: string
    proofName: string | null
    proofUploadedAt: string | null
    proofRequestedAt: string | null
    proofRequestMessage: string | null
    proofUrl: string | null
    buyerPhone: string | null
    reviews: Array<{
      id: string
      action: string
      reason: string | null
      reviewedAt: string
      reviewerName: string
      reviewerEmail: string
    }>
  }> = []
  if (isManagement || isSecretaria) {
    const { data } = await createAdminClient()
      .from('kitchen_meal_consumers')
      .select('purchase_group_id, requested_by, consumer_name, meal_date, selected_meals, final_amount, notes, created_at, payment_proof_path, payment_proof_name, payment_proof_uploaded_at, payment_proof_requested_at, payment_proof_request_message')
      .eq('organization_id', orgId)
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: false })
    const grouped = ((data ?? []) as MealPendingRow[]).reduce<Record<string, typeof pendingMealOrders[number] & { proofPath?: string | null }>>((acc, row) => {
      const current = acc[row.purchase_group_id] ?? {
        purchase_group_id: row.purchase_group_id,
        requestedBy: row.requested_by,
        consumer_name: row.consumer_name,
        dates: [],
        meals: [],
        total: 0,
        notes: row.notes,
        created_at: row.created_at,
        proofName: row.payment_proof_name,
        proofUploadedAt: row.payment_proof_uploaded_at,
        proofRequestedAt: row.payment_proof_requested_at,
        proofRequestMessage: row.payment_proof_request_message,
        proofUrl: null,
        buyerPhone: null,
        reviews: [],
        proofPath: row.payment_proof_path,
      }
      current.dates.push(row.meal_date)
      current.meals.push(...(Array.isArray(row.selected_meals) ? row.selected_meals : []))
      current.total += Number(row.final_amount ?? 0)
      current.proofName = current.proofName ?? row.payment_proof_name
      current.proofUploadedAt = current.proofUploadedAt ?? row.payment_proof_uploaded_at
      current.proofRequestedAt = current.proofRequestedAt ?? row.payment_proof_requested_at
      current.proofRequestMessage = current.proofRequestMessage ?? row.payment_proof_request_message
      current.requestedBy = current.requestedBy ?? row.requested_by
      current.proofPath = current.proofPath ?? row.payment_proof_path
      acc[row.purchase_group_id] = current
      return acc
    }, {})

    pendingMealOrders = await Promise.all(Object.values(grouped).map(async order => {
      if (!order.proofPath) return order
      const { data: signed } = await createAdminClient().storage.from('applicant-docs').createSignedUrl(order.proofPath, 60 * 60)
      return { ...order, proofUrl: signed?.signedUrl ?? null }
    }))

    const purchaseIds = pendingMealOrders.map(order => order.purchase_group_id)
    if (purchaseIds.length > 0) {
      type PaymentReviewRow = {
        id: string
        purchase_group_id: string
        action: string
        reason: string | null
        reviewed_by: string | null
        reviewed_at: string
      }
      const { data: reviewRows } = await createAdminClient()
        .from('kitchen_meal_payment_reviews')
        .select('id, purchase_group_id, action, reason, reviewed_by, reviewed_at')
        .eq('organization_id', orgId)
        .in('purchase_group_id', purchaseIds)
        .order('reviewed_at', { ascending: false })
      const reviewerIds = [...new Set(((reviewRows ?? []) as PaymentReviewRow[]).map(row => row.reviewed_by).filter(Boolean))] as string[]
      const reviewerMap = new Map<string, { name: string; email: string }>()
      for (const reviewerId of reviewerIds) {
        const { data: reviewer } = await createAdminClient().auth.admin.getUserById(reviewerId)
        if (reviewer.user) {
          reviewerMap.set(reviewerId, {
            name: (reviewer.user.user_metadata?.full_name as string | undefined)
              ?? (reviewer.user.user_metadata?.name as string | undefined)
              ?? reviewer.user.email
              ?? 'Usuário',
            email: reviewer.user.email ?? '—',
          })
        }
      }
      const reviewsByPurchase = ((reviewRows ?? []) as PaymentReviewRow[]).reduce<Record<string, typeof pendingMealOrders[number]['reviews']>>((acc, row) => {
        const reviewer = row.reviewed_by ? reviewerMap.get(row.reviewed_by) : null
        acc[row.purchase_group_id] = acc[row.purchase_group_id] ?? []
        acc[row.purchase_group_id].push({
          id: row.id,
          action: row.action,
          reason: row.reason,
          reviewedAt: row.reviewed_at,
          reviewerName: reviewer?.name ?? 'Usuário não identificado',
          reviewerEmail: reviewer?.email ?? '—',
        })
        return acc
      }, {})
      pendingMealOrders = pendingMealOrders.map(order => ({
        ...order,
        reviews: reviewsByPurchase[order.purchase_group_id] ?? [],
      }))
    }

    const mealBuyerIds = [...new Set(pendingMealOrders.map(order => order.requestedBy).filter(Boolean))] as string[]
    if (mealBuyerIds.length > 0) {
      const sbAdmin = createAdminClient()
      const mealBuyerEmails = new Map<string, string>()
      for (const buyerId of mealBuyerIds) {
        const { data: buyer } = await sbAdmin.auth.admin.getUserById(buyerId)
        if (buyer.user?.email) mealBuyerEmails.set(buyerId, buyer.user.email)
      }
      const { data: staffProfiles } = await sbAdmin
        .from('staff_profiles')
        .select('user_id, person_id')
        .eq('organization_id', orgId)
        .in('user_id', mealBuyerIds)
      const personByBuyer = new Map<string, string>()
      for (const row of (staffProfiles ?? []) as Array<{ user_id: string | null; person_id: string }>) {
        if (row.user_id) personByBuyer.set(row.user_id, row.person_id)
      }

      const missingBuyerIds = mealBuyerIds.filter(id => !personByBuyer.has(id) && mealBuyerEmails.get(id))
      if (missingBuyerIds.length > 0) {
        const { data: emailContacts } = await sbAdmin
          .from('person_contacts')
          .select('person_id, value')
          .eq('type', 'email')
          .in('value', missingBuyerIds.map(id => mealBuyerEmails.get(id) as string))
        const buyerByEmail = new Map([...mealBuyerEmails.entries()].map(([id, email]) => [email.toLowerCase(), id]))
        for (const contact of (emailContacts ?? []) as Array<{ person_id: string; value: string }>) {
          const buyerId = buyerByEmail.get(contact.value.toLowerCase())
          if (buyerId && !personByBuyer.has(buyerId)) personByBuyer.set(buyerId, contact.person_id)
        }
      }

      const personIds = [...new Set([...personByBuyer.values()])]
      const phoneByBuyer = new Map<string, string | null>()
      if (personIds.length > 0) {
        const { data: phoneContacts } = await sbAdmin
          .from('person_contacts')
          .select('person_id, type, value, is_primary')
          .in('person_id', personIds)
          .in('type', ['whatsapp', 'phone'])
        const contactsByPerson = new Map<string, Array<{ type: string; value: string; is_primary: boolean }>>()
        for (const contact of (phoneContacts ?? []) as Array<{ person_id: string; type: string; value: string; is_primary: boolean }>) {
          const list = contactsByPerson.get(contact.person_id) ?? []
          list.push(contact)
          contactsByPerson.set(contact.person_id, list)
        }
        for (const [buyerId, personId] of personByBuyer.entries()) {
          const contacts = contactsByPerson.get(personId) ?? []
          const chosen = contacts.find(c => c.type === 'whatsapp' && c.is_primary)
            ?? contacts.find(c => c.type === 'whatsapp')
            ?? contacts.find(c => c.type === 'phone' && c.is_primary)
            ?? contacts.find(c => c.type === 'phone')
          phoneByBuyer.set(buyerId, chosen?.value ?? null)
        }
      }
      pendingMealOrders = pendingMealOrders.map(order => ({
        ...order,
        buyerPhone: order.requestedBy ? phoneByBuyer.get(order.requestedBy) ?? null : null,
      }))
    }
  }

  type SelfMealProofRow = {
    purchase_group_id: string
    meal_date: string
    selected_meals: string[] | null
    final_amount: number | null
    payment_proof_requested_at: string | null
    payment_proof_uploaded_at: string | null
    payment_proof_request_message: string | null
  }
  let selfMealProofRequests: Array<{
    purchase_group_id: string
    dates: string[]
    meals: string[]
    total: number
    requestedAt: string
    message: string | null
  }> = []
  if (canBuyMeals && user) {
    const { data } = await createAdminClient()
      .from('kitchen_meal_consumers')
      .select('purchase_group_id, meal_date, selected_meals, final_amount, payment_proof_requested_at, payment_proof_uploaded_at, payment_proof_request_message')
      .eq('organization_id', orgId)
      .eq('requested_by', user.id)
      .eq('payment_status', 'pending')
      .not('payment_proof_requested_at', 'is', null)
      .order('payment_proof_requested_at', { ascending: false })
    selfMealProofRequests = Object.values(((data ?? []) as SelfMealProofRow[]).reduce<Record<string, typeof selfMealProofRequests[number]>>((acc, row) => {
      if (!row.payment_proof_requested_at) return acc
      if (row.payment_proof_uploaded_at && new Date(row.payment_proof_uploaded_at) >= new Date(row.payment_proof_requested_at)) return acc
      const current = acc[row.purchase_group_id] ?? {
        purchase_group_id: row.purchase_group_id,
        dates: [],
        meals: [],
        total: 0,
        requestedAt: row.payment_proof_requested_at,
        message: row.payment_proof_request_message,
      }
      current.dates.push(row.meal_date)
      current.meals.push(...(Array.isArray(row.selected_meals) ? row.selected_meals : []))
      current.total += Number(row.final_amount ?? 0)
      current.requestedAt = new Date(row.payment_proof_requested_at) > new Date(current.requestedAt) ? row.payment_proof_requested_at : current.requestedAt
      current.message = row.payment_proof_request_message ?? current.message
      acc[row.purchase_group_id] = current
      return acc
    }, {})).sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
  }

  // ── Server actions inline ───────────────────────────────────────────────────
  const handleServiceStatusUpdate = async (formData: FormData) => {
    'use server'
    await updateServiceStatus(formData.get('request_id') as string, formData.get('status') as string, user!.id)
    redirect(`/${slug}/pendentes`)
  }

  const handleResolverHospedagemComAlocacao = async (params: {
    requestId: string; roomId: string; bedId: string | null; personId: string | null
    guestName: string; guestType: 'obreiro' | 'aluno'; checkIn: string; checkOut: string
  }) => {
    'use server'
    if (!user) return
    const { resolverHospedagemComAlocacao } = await import('../hospedagem/actions')
    await resolverHospedagemComAlocacao({ ...params, organizationId: orgId, reviewedBy: user.id })
    redirect(`/${slug}/pendentes`)
  }

  const handleResolverHospedagemSemAlocacao = async (params: {
    requestId: string; guestName: string; staffApplicationId: string | null; schoolApplicationId: string | null; requestedArrivalDate: string | null
  }) => {
    'use server'
    if (!user) return
    const { resolverHospedagemSemAlocacao } = await import('../hospedagem/actions')
    await resolverHospedagemSemAlocacao({ ...params, organizationId: orgId, reviewedBy: user.id })
    redirect(`/${slug}/pendentes`)
  }

  const handleConfirmMealPayment = async (formData: FormData) => {
    'use server'
    if (!user) return
    await confirmMealPayment({
      organizationId: orgId,
      purchaseGroupId: String(formData.get('purchase_group_id') ?? ''),
      confirmedBy: user.id,
    })
    redirect(`/${slug}/pendentes`)
  }

  const handleRequestMealPaymentProof = async (formData: FormData) => {
    'use server'
    if (!user) return
    await requestMealPaymentProof({
      organizationId: orgId,
      purchaseGroupId: String(formData.get('purchase_group_id') ?? ''),
      requestedBy: user.id,
    })
    redirect(`/${slug}/pendentes`)
  }

  const handleRejectMealPayment = async (formData: FormData) => {
    'use server'
    if (!user) return
    await rejectMealPayment({
      organizationId: orgId,
      purchaseGroupId: String(formData.get('purchase_group_id') ?? ''),
      rejectedBy: user.id,
      reason: String(formData.get('reason') ?? ''),
    })
    redirect(`/${slug}/pendentes`)
  }

  const handleCancelMinistryRequest = async (formData: FormData) => {
    'use server'
    await cancelRequest(formData.get('request_id') as string)
    redirect(`/${slug}/pendentes`)
  }

  const handleAcceptStaffForDh = async (formData: FormData) => {
    'use server'
    if (!user) return
    const sbAdmin = createAdminClient()
    const now = new Date().toISOString()
    await sbAdmin.from('staff_applications').update({
      status: 'em_analise',
      reviewed_at: now,
      reviewed_by: user.id,
      leader_accepted_at: now,
      leader_accepted_by: user.id,
    }).eq('id', formData.get('application_id') as string)
    redirect(`/${slug}/pendentes`)
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
  const fmtMoney = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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

        {isPreview && (
          <div className="border rounded-lg px-4 py-3 text-sm bg-amber-50 border-amber-200 text-amber-800">
            Modo visualização do super admin: use esta tela para conferir permissões e listas antes de executar ações reais.
          </div>
        )}

        {selfMealProofRequests.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
              <h3 className="text-sm font-semibold text-amber-900">
                Comprovante de refeição solicitado
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                  {selfMealProofRequests.length}
                </span>
              </h3>
              <p className="text-xs text-amber-700">A Secretaria pediu correção ou envio de comprovante para uma compra sua.</p>
            </div>
            <div className="divide-y divide-amber-100">
              {selfMealProofRequests.map(request => (
                <div key={request.purchase_group_id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Pedido {request.purchase_group_id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-600">
                        {request.dates.length} dia{request.dates.length === 1 ? '' : 's'} · {[...new Set(request.meals)].join(', ')}
                      </p>
                      <p className="mt-1 text-sm font-bold text-gray-900">Valor da compra: {fmtMoney(request.total)}</p>
                      <p className="mt-1 text-xs text-amber-800">
                        {request.message ?? 'Houve um problema com a confirmação de pagamento da sua refeição. Por favor, coloque o comprovante aqui ou dirija-se à Secretaria. Obrigado.'}
                      </p>
                    </div>
                    <Link
                      href={`/${slug}/refeicoes?pedido=${request.purchase_group_id}`}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                    >
                      Enviar comprovante
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(isManagement || isSecretaria) && pendingMealOrders.length > 0 && (
          <div className="bg-white rounded-xl border border-yellow-200 overflow-hidden">
            <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
              <h3 className="text-sm font-semibold text-yellow-900">
                Refeições aguardando confirmação de pagamento
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                  {pendingMealOrders.length}
                </span>
              </h3>
              <p className="text-xs text-yellow-700">Confira o valor cobrado no sistema com o comprovante antes de confirmar.</p>
            </div>
            <div className="divide-y divide-yellow-100">
              {pendingMealOrders.map(order => (
                <div key={order.purchase_group_id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{order.consumer_name}</p>
                      <p className="text-xs text-gray-600">
                        Pedido {order.purchase_group_id.slice(0, 8)} · {order.dates.length} dia{order.dates.length === 1 ? '' : 's'} · {[...new Set(order.meals)].join(', ')}
                      </p>
                      <p className="mt-1 text-sm font-bold text-gray-900">Valor cobrado: {fmtMoney(order.total)}</p>
                      {order.notes && <p className="mt-1 text-xs text-gray-500">Observação: {order.notes}</p>}
                      <div className="mt-2">
                        <WhatsAppButton phone={order.buyerPhone} />
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <form action={handleConfirmMealPayment}>
                        <input type="hidden" name="purchase_group_id" value={order.purchase_group_id} />
                        <button className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600">
                          Confirmar pagamento
                        </button>
                      </form>
                      <form action={handleRequestMealPaymentProof}>
                        <input type="hidden" name="purchase_group_id" value={order.purchase_group_id} />
                        <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-yellow-800 ring-1 ring-yellow-200 hover:bg-yellow-100">
                          Solicitar novo comprovante
                        </button>
                      </form>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-yellow-100 bg-yellow-50/60 p-3 text-xs text-yellow-900">
                    <p className="font-semibold">Comprovante</p>
                    {order.proofUrl ? (
                      <p className="mt-1">
                        <a href={order.proofUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 hover:text-blue-900">
                          Abrir comprovante
                        </a>
                        {order.proofName && <span className="text-yellow-800"> · {order.proofName}</span>}
                      </p>
                    ) : (
                      <>
                        <p className="mt-1 text-yellow-800">Ainda não há comprovante anexado pela pessoa.</p>
                        {order.proofRequestedAt && (
                          <p className="mt-1 text-yellow-700">
                            Solicitação enviada em {new Date(order.proofRequestedAt).toLocaleString('pt-BR')}.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <form action={handleRejectMealPayment} className="mt-3 rounded-lg border border-red-100 bg-red-50/60 p-3">
                    <input type="hidden" name="purchase_group_id" value={order.purchase_group_id} />
                    <label className="block text-xs font-semibold text-red-900" htmlFor={`reason-${order.purchase_group_id}`}>
                      Recusar pagamento
                    </label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <textarea
                        id={`reason-${order.purchase_group_id}`}
                        name="reason"
                        required
                        rows={2}
                        placeholder="Explique o motivo da recusa para a pessoa."
                        className="min-h-16 flex-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                      <button className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 sm:self-start">
                        Recusar e solicitar correção
                      </button>
                    </div>
                  </form>
                  {order.reviews.length > 0 && (
                    <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-700">Histórico da análise</p>
                      <div className="mt-2 space-y-2">
                        {order.reviews.map(review => (
                          <div key={review.id} className="text-xs text-gray-600">
                            <p>
                              <span className="font-semibold text-gray-800">
                                {review.action === 'payment_rejected' ? 'Pagamento recusado' : 'Comprovante solicitado'}
                              </span>
                              {' '}por {review.reviewerName}
                              {review.reviewerEmail !== '—' ? ` (${review.reviewerEmail})` : ''}
                              {' '}em {new Date(review.reviewedAt).toLocaleString('pt-BR')}
                            </p>
                            {review.reason && <p className="mt-0.5 text-gray-500">Observação: {review.reason}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ VISÃO LIDER_MINISTERIO ════ */}
        {isLiderMinisterio && (
          <>
            {myMinistryRequests.length === 0 && myServiceRequests.length === 0 && myStaffApplications.length === 0 ? (
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
                {myStaffApplications.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700">
                        Candidatos a Obreiro — {liderMinisterioMinistrioNome ?? 'Ministério'}
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                          {myStaffApplications.length}
                        </span>
                      </h3>
                    </div>
                    <div className="p-3 space-y-2">
                      {myStaffApplications.map(app => (
                        <div key={app.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{app.people?.full_name ?? '—'}</p>
                            <p className="text-xs text-gray-400">{daysAgo(app.applied_at)}d atrás</p>
                          </div>
                          <form action={handleAcceptStaffForDh}>
                            <input type="hidden" name="application_id" value={app.id} />
                            <button type="submit" className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors">
                              Enviar ao DH
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                    <div className="p-3 space-y-2">
                      {myMinistryRequests.map(req => {
                        const pName = (req.people as { full_name: string } | null)?.full_name
                        const rName = (req.ministry_roles as { name: string } | null)?.name
                        return (
                          <div key={req.id} className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5">
                            <div className="text-sm min-w-0">
                              <p className="font-semibold text-gray-900">
                                {REQUEST_LABELS[req.request_type] ?? req.request_type}
                                {pName && ` — ${pName}`}
                                {rName && ` → ${rName}`}
                              </p>
                              {req.notes && (
                                <p className="text-xs text-gray-400 italic mt-0.5">&ldquo;{req.notes}&rdquo;</p>
                              )}
                              <p className="text-xs text-gray-400 mt-0.5">{daysAgo(req.created_at)}d atrás</p>
                            </div>
                            <form action={handleCancelMinistryRequest} className="flex-shrink-0">
                              <input type="hidden" name="request_id" value={req.id} />
                              <button type="submit" className="text-xs text-gray-400 hover:text-red-600 transition-colors whitespace-nowrap">
                                Cancelar
                              </button>
                            </form>
                          </div>
                        )
                      })}
                    </div>
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
                    <div className="p-3 space-y-2">
                      {myServiceRequests.map(sr => {
                        const statusInfo = SERVICE_STATUS_LABELS[sr.status] ?? { label: sr.status, color: 'bg-gray-100 text-gray-500' }
                        return (
                          <div key={sr.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5">
                            <div className="text-sm min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{sr.subject}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {sr.target_department} · {sr.request_type} · {daysAgo(sr.created_at)}d atrás
                              </p>
                            </div>
                            <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ════ VISÃO DE DEPARTAMENTO ════ */}
        {seesDepartmentServices && !isManagement && !isLiderMinisterio && (
          <>
            {serviceRequests.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-3xl mb-3">✓</p>
                <p className="text-gray-400 text-sm">Nenhuma solicitação para sua área no momento.</p>
              </div>
            ) : (
              <ServiceRequestsPanel
                title={`Solicitações da área`}
                requests={serviceRequests.map(sr => ({
                  ...sr,
                  requesterName: requesterMap.get(sr.requester_id)?.name ?? sr.requester_role,
                  requesterEmail: requesterMap.get(sr.requester_id)?.email ?? '—',
                  requesterPhone: requesterMap.get(sr.requester_id)?.phone ?? null,
                  diasAberto: daysAgo(sr.created_at),
                }))}
                handleStatusUpdate={handleServiceStatusUpdate}
                resolverComAlocacao={handleResolverHospedagemComAlocacao}
                resolverSemAlocacao={handleResolverHospedagemSemAlocacao}
                organizationId={orgId}
              />
            )}
          </>
        )}

        {/* ════ VISÃO GESTÃO + LIDER_ETED ════ */}
        {(isManagement || isLiderEted) && (
          <>
            {!hasPendingItems && pendingMealOrders.length === 0 && selfMealProofRequests.length === 0 ? (
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
                    <AnimatedDonutChart segments={categorySegments} title="total" />
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Por urgência</h3>
                    <AnimatedDonutChart segments={urgencySegments} title="total" />
                  </div>
                </div>

                {/* Busca */}
                <Suspense>
                  <SearchBar placeholder="Buscar por nome…" className="w-full sm:w-72" />
                </Suspense>

                {/* Cards principais (client component com modal) */}
                <PendentesCardList items={filteredItems} />
              </>
            )}

            {/* ── Seção: Solicitações de Ministério (gestão) ── */}
            {canWrite && ministryRequests.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Solicitações de Ministério
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                      {ministryRequests.length}
                    </span>
                  </h3>
                </div>
                <div className="p-3 space-y-2">
                  {ministryRequests.map(req => {
                    const pName = (req.people as { full_name: string } | null)?.full_name
                    const rName = (req.ministry_roles as { name: string } | null)?.name
                    const mName = (req.ministries as { name: string } | null)?.name
                    const dias  = daysAgo(req.created_at)
                    const urg   = urgencyBadge(dias)
                    const requester = requesterMap.get(req.requested_by)
                    return (
                      <Link
                        key={req.id}
                        href={`/${slug}/ministerios/${req.ministry_id}`}
                        className="group flex items-start gap-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
                      >
                        <span className={`flex-shrink-0 inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold ${urg.color}`}>
                          {urg.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                            {REQUEST_LABELS[req.request_type] ?? req.request_type}
                            {pName && ` — ${pName}`}
                            {rName && ` → ${rName}`}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">Ministério: {mName ?? '—'}</p>
                          {req.notes && <p className="text-xs text-gray-400 italic mt-0.5">&ldquo;{req.notes}&rdquo;</p>}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-500">{requester?.name ?? '—'}</span>
                            <WhatsAppButton phone={requester?.phone} />
                          </div>
                        </div>
                        <span className="flex-shrink-0 text-xs font-semibold text-brand-500 group-hover:text-brand-700 transition-colors">
                          Abrir →
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Seção: Solicitações de Escola (gestão) ── */}
            {canWrite && schoolRequests.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Solicitações de Escola
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                      {schoolRequests.length}
                    </span>
                  </h3>
                </div>
                <div className="p-3 space-y-2">
                  {schoolRequests.map(req => {
                    const pName = req.people?.full_name
                    const sName = req.schools?.name
                    const dias  = daysAgo(req.created_at)
                    const urg   = urgencyBadge(dias)
                    const requester = requesterMap.get(req.requested_by)
                    return (
                      <Link
                        key={req.id}
                        href={`/${slug}/escolas/${req.school_id}`}
                        className="group flex items-start gap-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
                      >
                        <span className={`flex-shrink-0 inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold ${urg.color}`}>
                          {urg.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                            Adicionar obreiro
                            {pName && ` — ${pName}`}
                            {req.role && ` → ${req.role}`}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">Escola: {sName ?? '—'}</p>
                          {req.notes && <p className="text-xs text-gray-400 italic mt-0.5">&ldquo;{req.notes}&rdquo;</p>}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-500">{requester?.name ?? '—'}</span>
                            <WhatsAppButton phone={requester?.phone} />
                          </div>
                        </div>
                        <span className="flex-shrink-0 text-xs font-semibold text-brand-500 group-hover:text-brand-700 transition-colors">
                          Abrir →
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Seção: Serviços recebidos (gestão + hospitalidade) ── */}
            {(isManagement || isHospitalidade || seesDepartmentServices) && serviceRequests.length > 0 && (
              <ServiceRequestsPanel
                title="Serviços Recebidos"
                requests={serviceRequests.map(sr => ({
                  ...sr,
                  requesterName: requesterMap.get(sr.requester_id)?.name ?? sr.requester_role,
                  requesterEmail: requesterMap.get(sr.requester_id)?.email ?? '—',
                  requesterPhone: requesterMap.get(sr.requester_id)?.phone ?? null,
                  diasAberto: daysAgo(sr.created_at),
                }))}
                handleStatusUpdate={handleServiceStatusUpdate}
                resolverComAlocacao={handleResolverHospedagemComAlocacao}
                resolverSemAlocacao={handleResolverHospedagemSemAlocacao}
                organizationId={orgId}
              />
            )}

          </>
        )}
      </main>
    </>
  )
}
