import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { RecusarModal } from './RecusarModal'
import { DisponibilizarFormularioButton } from './DisponibilizarFormularioButton'
import { NovaPreInscricaoButton, EditarPreInscricaoButton, MarcarRecebidoExternoButton, LinksReferenciaAdminButton } from './InscricoesModals'
import { getEmailQuota } from '@/lib/email/getEmailQuota'
import { getRolePreview } from '@/lib/role-preview'
import { SearchBar } from '@/components/ui/SearchBar'
import { Suspense } from 'react'
import { SCHOOL_APPLICATION_TYPES } from '@/lib/schools'
import { ClipboardList, Mail, MessageCircle } from 'lucide-react'
import { ServirLinkCard } from './ServirLinkCard'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string; ver?: string; q?: string }>
}

type InscricaoItem = {
  id: string
  tipo: 'pre_inscricao' | 'aluno' | 'obreiro' | 'pre_inscricao_obreiro'
  tipoLabel: string
  tipoColor: string
  nome: string
  email: string | null
  phone: string | null
  escola: string | null
  schoolId: string | null
  turma: string | null
  classId: string | null
  mensagem: string | null
  status: string
  notes: string | null
  criadoEm: string
  diasAberto: number
  personId: string | null
  ministryId?: string | null
  hasLogin?: boolean
  applicationId?: string | null
  staffApplicationId?: string | null
  hasFormData?: boolean
}

type HistoricoItem = {
  id: string
  tipo: string
  nome: string
  escola: string | null
  motivo: string
  recusadoPor: string | null
  recusadoPorId: string | null
  recusadoEm: string
}

const TIPO_TABS = [
  { key: 'todas',         label: 'Todas' },
  { key: 'pre_inscricao', label: 'Pré-inscrições' },
  { key: 'aluno',         label: 'Alunos' },
  { key: 'obreiro',       label: 'Obreiros' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente:           { label: 'Pendente',      color: 'bg-yellow-100 text-yellow-700' },
  formulario_enviado: { label: 'Form. enviado', color: 'bg-blue-100 text-blue-700' },
  em_contato:         { label: 'Em contato',   color: 'bg-purple-100 text-purple-700' },
  em_analise:         { label: 'Em análise',   color: 'bg-blue-100 text-blue-700' },
  convertido:         { label: 'Convertido',   color: 'bg-green-100 text-green-700' },
  aprovado:           { label: 'Aprovado',     color: 'bg-green-100 text-green-700' },
  reprovado:          { label: 'Reprovado',    color: 'bg-red-100 text-red-700' },
  descartado:         { label: 'Recusado',     color: 'bg-gray-100 text-gray-500' },
  cancelado:          { label: 'Cancelado',    color: 'bg-gray-100 text-gray-500' },
}

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}
function urgencyBorderColor(dias: number) {
  if (dias <= 1) return 'border-l-green-400'
  if (dias === 2) return 'border-l-yellow-400'
  if (dias === 3) return 'border-l-orange-400'
  return 'border-l-red-500'
}
function urgencyBadge(dias: number) {
  if (dias === 0) return { label: 'Hoje', color: 'bg-green-100 text-green-700' }
  if (dias === 1) return { label: '1d',   color: 'bg-green-100 text-green-700' }
  if (dias === 2) return { label: '2d',   color: 'bg-yellow-100 text-yellow-700' }
  if (dias === 3) return { label: '3d',   color: 'bg-orange-100 text-orange-700' }
  return { label: `${dias}d`, color: 'bg-red-100 text-red-700' }
}
const isFinalizado = (s: string) => ['convertido','aprovado','descartado','reprovado','cancelado'].includes(s)

function getUserDisplayName(user: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined) {
  const metadata = user?.user_metadata ?? {}
  const name = metadata.full_name ?? metadata.name
  return typeof name === 'string' && name.trim() ? name : user?.email ?? null
}

type OpenClassOption = {
  id: string
  school_id: string
  name: string
  starts_at: string | null
  schools: { name: string } | null
}

export default async function InscricoesPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { tab = 'todas', ver = 'ativas', q } = await searchParams

  const supabase = await createClient()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const sb = createAdminClient()
  const orgId = org.id

  const { data: { user } } = await supabase.auth.getUser()
  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user?.id ?? '')
    .eq('active', true)

  const userOrgRows = (orgUsers ?? []) as unknown as Array<{
    organization_id: string | null
    roles: { name: string } | null
  }>
  const superadminRow = userOrgRows.find(row => row.roles?.name === 'superadmin')
  const currentOrgRow = userOrgRows.find(row => row.organization_id === orgId)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  const preview = await getRolePreview(realRole)
  const userRole = preview?.role ?? realRole
  const isEtedLeader = userRole === 'lider_eted'
  const isManagement = ['superadmin', 'admin_base', 'lider_base', 'dh'].includes(userRole)

  let allowedSchoolIds: string[] | null = null
  if (isEtedLeader) {
    const leaderSchools = preview?.schoolId
      ? [{ school_id: preview.schoolId }]
      : (await supabase
        .from('school_leaders')
        .select('school_id')
        .eq('organization_id', orgId)
        .eq('user_id', user?.id ?? '')).data
    allowedSchoolIds = leaderSchools?.map(row => row.school_id) ?? []
  }

  let openClassesQuery = sb
    .from('school_classes')
    .select('id, school_id, name, starts_at, schools!inner(name, organization_id, school_type)')
    .eq('active', true)
    .eq('registrations_open', true)
    .eq('schools.organization_id', orgId)
    .in('schools.school_type', [...SCHOOL_APPLICATION_TYPES])
    .order('starts_at', { ascending: true })

  if (allowedSchoolIds) {
    openClassesQuery = openClassesQuery.in('school_id', allowedSchoolIds.length > 0 ? allowedSchoolIds : ['no-match'])
  }

  const { data: openClassesRaw } = await openClassesQuery
  const openClasses = (openClassesRaw ?? []) as unknown as OpenClassOption[]

  // ── Server actions ─────────────────────────────────────────────────────────

  async function updateStatus(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const db = adm()
    const tipo = formData.get('tipo') as string
    const id   = formData.get('id') as string
    const status = formData.get('status') as string
    const now  = new Date().toISOString()
    if (tipo === 'pre_inscricao') {
      await db.from('school_interest_forms').update({ status, responded_at: now }).eq('id', id)
    } else if (tipo === 'pre_inscricao_obreiro') {
      await db.from('staff_interest_forms').update({ status, responded_at: now }).eq('id', id)
    } else if (tipo === 'aluno') {
      await db.from('student_applications').update({ status, reviewed_at: now }).eq('id', id)
    } else {
      await db.from('staff_applications').update({ status, reviewed_at: now }).eq('id', id)
    }
    const { redirect: redir } = await import('next/navigation')
    const label = status === 'em_contato' ? 'Marcado como Em contato' : status === 'em_analise' ? 'Marcado como Em análise' : 'Status atualizado'
    const tabRedirect = tipo === 'pre_inscricao' ? 'pre_inscricao' : tipo === 'pre_inscricao_obreiro' ? 'obreiro' : tipo
    redir(`/${slug}/inscricoes?tab=${tabRedirect}&flash_success=${encodeURIComponent(label)}`)
  }

  async function recusar(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { createClient } = await import('@/lib/supabase/server')
    const db = adm()
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    const tipo   = formData.get('tipo') as string
    const id     = formData.get('id') as string
    const reason = (formData.get('reason') as string)?.trim()
    if (!reason) return
    const now = new Date().toISOString()
    if (tipo === 'pre_inscricao') {
      const { error } = await db.from('school_interest_forms')
        .update({ status: 'descartado', refusal_reason: reason, responded_at: now, reviewed_at: now, reviewed_by: user?.id ?? null })
        .eq('id', id)
      if (error?.code === 'PGRST204') {
        await db.from('school_interest_forms')
          .update({ status: 'descartado', refusal_reason: reason, responded_at: now })
          .eq('id', id)
      }
    } else if (tipo === 'pre_inscricao_obreiro') {
      await db.from('staff_interest_forms')
        .update({ status: 'descartado', refusal_reason: reason, responded_at: now, reviewed_at: now, reviewed_by: user?.id ?? null })
        .eq('id', id)
    } else if (tipo === 'aluno') {
      await db.from('student_applications')
        .update({ status: 'reprovado', refusal_reason: reason, reviewed_at: now, reviewed_by: user?.id ?? null })
        .eq('id', id)
    } else {
      const { error } = await db.from('staff_applications')
        .update({ status: 'reprovado', refusal_reason: reason, reviewed_at: now, reviewed_by: user?.id ?? null })
        .eq('id', id)
      if (error?.code === 'PGRST204') {
        await db.from('staff_applications')
          .update({ status: 'reprovado', reviewed_at: now, reviewed_by: user?.id ?? null })
          .eq('id', id)
      }
    }
    // Note: router.refresh() is called in RecusarModal client component
  }

  async function aprovar(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const db = adm()
    const { createClient } = await import('@/lib/supabase/server')
    const authClient = await createClient()
    const tipo      = formData.get('tipo') as string
    const id        = formData.get('id') as string
    const email     = (formData.get('email') as string | null)?.toLowerCase() ?? ''
    const personIdI = formData.get('person_id') as string | null
    const orgIdForm = formData.get('org_id') as string
    const classId   = formData.get('class_id') as string | null
    const now       = new Date().toISOString()
    const { data: { user: actingUser } } = await authClient.auth.getUser()

    if (tipo !== 'obreiro' && !classId) return

    type ClassRowData = { id: string; name: string; starts_at: string | null; school_id: string; schools: { name: string; organization_id: string; school_type: string; contact_email: string | null } }
    let approvedClassRow: ClassRowData | null = null

    if (tipo !== 'obreiro' && classId) {
      const { data: orgUsers } = await authClient
        .from('organization_users')
        .select('organization_id, roles(name)')
        .eq('user_id', actingUser?.id ?? '')
        .eq('active', true)

      const userOrgRows = (orgUsers ?? []) as unknown as Array<{
        organization_id: string | null
        roles: { name: string } | null
      }>
      const superadminRow = userOrgRows.find(row => row.roles?.name === 'superadmin')
      const currentOrgRow = userOrgRows.find(row => row.organization_id === orgIdForm)
      const role = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''

      const { data: classRow } = await db
        .from('school_classes')
        .select('id, name, starts_at, school_id, schools!inner(name, organization_id, school_type, contact_email)')
        .eq('id', classId)
        .eq('active', true)
        .eq('registrations_open', true)
        .eq('schools.organization_id', orgIdForm)
        .in('schools.school_type', [...SCHOOL_APPLICATION_TYPES])
        .single()
      if (!classRow) return
      approvedClassRow = classRow as unknown as ClassRowData

      if (role === 'lider_eted') {
        const { data: leaderLink } = await db
          .from('school_leaders')
          .select('id')
          .eq('organization_id', orgIdForm)
          .eq('user_id', actingUser?.id ?? '')
          .eq('school_id', approvedClassRow.school_id)
          .maybeSingle()
        if (!leaderLink) return
      }
    }

    let personId = personIdI || null
    if (!personId && email) {
      const { data: contact } = await db.from('person_contacts').select('person_id')
        .eq('type', 'email').eq('value', email).maybeSingle()
      personId = contact?.person_id ?? null
    }
    if (personId) {
      const { data: existing } = await db.from('student_profiles').select('id').eq('person_id', personId).maybeSingle()
      if (!existing) {
        const { error } = await db.from('student_profiles').insert({
          organization_id: orgIdForm,
          person_id: personId,
          active: true,
          accepted_by: actingUser?.id ?? null,
          accepted_at: now,
        })
        if (error?.code === 'PGRST204') {
          await db.from('student_profiles').insert({ organization_id: orgIdForm, person_id: personId, active: true })
        }
      } else {
        const { error } = await db.from('student_profiles')
          .update({ accepted_by: actingUser?.id ?? null, accepted_at: now })
          .eq('id', existing.id)
        if (error?.code === 'PGRST204') {
          await db.from('student_profiles')
            .update({ active: true })
            .eq('id', existing.id)
        }
      }
      await db.from('people').update({ source: null }).eq('id', personId)

      if (classId) {
        await db.from('class_students').upsert({
          class_id: classId,
          person_id: personId,
          status: 'ativo',
        }, { onConflict: 'class_id,person_id' })
      }
    }
    if (tipo === 'pre_inscricao') {
      const { error } = await db.from('school_interest_forms')
        .update({ status: 'convertido', responded_at: now, reviewed_at: now, reviewed_by: actingUser?.id ?? null, class_id: classId })
        .eq('id', id)
      if (error?.code === 'PGRST204') {
        await db.from('school_interest_forms').update({ status: 'convertido', responded_at: now, class_id: classId }).eq('id', id)
      }
    } else if (tipo === 'aluno') {
      await db.from('student_applications')
        .update({ status: 'aprovado', reviewed_at: now, reviewed_by: actingUser?.id ?? null, class_id: classId })
        .eq('id', id)
    }
    // Email de aprovação — best-effort, não bloqueia o redirect
    if (personId && approvedClassRow && classId) {
      const schoolInfo = approvedClassRow.schools
      if (schoolInfo?.contact_email) {
        let recipientEmail = email || null
        if (!recipientEmail) {
          const { data: contact } = await db.from('person_contacts')
            .select('value').eq('person_id', personId).eq('type', 'email')
            .order('is_primary', { ascending: false }).limit(1).maybeSingle()
          recipientEmail = (contact as { value?: string } | null)?.value ?? null
        }
        if (recipientEmail) {
          const { data: personRow } = await db.from('people').select('full_name').eq('id', personId).maybeSingle()
          const { sendApprovalEmail } = await import('@/lib/email/sendApprovalEmail')
          sendApprovalEmail({
            to: recipientEmail,
            candidateName: (personRow as { full_name?: string } | null)?.full_name ?? 'Candidato',
            schoolName: schoolInfo.name,
            className: approvedClassRow.name,
            startsAt: approvedClassRow.starts_at,
            replyTo: schoolInfo.contact_email,
            organizationId: orgIdForm,
            schoolId: approvedClassRow.school_id,
          }).catch(() => {})
        }
      }
    }

    const { redirect: redir } = await import('next/navigation')
    redir(`/${slug}/pessoas?tab=alunos&flash_success=${encodeURIComponent('Aluno aprovado e adicionado à turma')}`)
  }

  async function encaminharObreiroDh(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { createClient } = await import('@/lib/supabase/server')
    const db = adm()
    const authClient = await createClient()
    const id = formData.get('id') as string
    const now = new Date().toISOString()
    const { data: { user } } = await authClient.auth.getUser()
    if (!id || !user) return
    await db.from('staff_applications').update({
      status: 'em_analise',
      reviewed_at: now,
      reviewed_by: user.id,
      leader_accepted_at: now,
      leader_accepted_by: user.id,
    }).eq('id', id)
  }

  async function finalizarObreiro(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { createClient } = await import('@/lib/supabase/server')
    const { redirect: redir } = await import('next/navigation')
    const db = adm()
    const authClient = await createClient()
    const id = formData.get('id') as string
    const orgIdForm = formData.get('org_id') as string
    const personId = formData.get('person_id') as string
    const ministryId = (formData.get('ministry_id') as string | null) || null
    const email = (formData.get('email') as string).trim().toLowerCase()
    const password = formData.get('password') as string
    const now = new Date().toISOString()
    if (!id || !orgIdForm || !personId || !email || !password) return

    const { data: { user: actingUser } } = await authClient.auth.getUser()
    const { data: orgUsers } = await authClient
      .from('organization_users')
      .select('organization_id, roles(name)')
      .eq('user_id', actingUser?.id ?? '')
      .eq('active', true)

    const memberships = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
    const role = memberships.find(row => row.roles?.name === 'superadmin')?.roles?.name
      ?? memberships.find(row => row.organization_id === orgIdForm)?.roles?.name
      ?? ''
    if (!['superadmin', 'admin_base', 'lider_base', 'dh'].includes(role)) return

    const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 })
    const existingAuthUser = users.find(authUser => authUser.email?.toLowerCase() === email)
    let userId = existingAuthUser?.id

    if (!userId) {
      const { data: created, error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: formData.get('name') as string },
      })
      if (error || !created.user) return
      userId = created.user.id
    }

    const { data: ministryRole } = await db.from('roles').select('id').eq('name', 'obreiro_ministerio').single()
    if (ministryRole) {
      const { data: existingOrgUser } = await db
        .from('organization_users')
        .select('id')
        .eq('organization_id', orgIdForm)
        .eq('user_id', userId)
        .maybeSingle()
      if (existingOrgUser) {
        await db.from('organization_users').update({ role_id: ministryRole.id, active: true, updated_at: now }).eq('id', existingOrgUser.id)
      } else {
        await db.from('organization_users').insert({ organization_id: orgIdForm, user_id: userId, role_id: ministryRole.id, active: true })
      }
    }

    const { data: existingProfile } = await db.from('staff_profiles').select('id').eq('person_id', personId).maybeSingle()
    const profilePayload = {
      organization_id: orgIdForm,
      person_id: personId,
      role_title: 'Obreiro',
      area: ministryId ? null : 'Base',
      active: true,
      user_id: userId,
      accepted_by: actingUser?.id ?? null,
      accepted_at: now,
    }
    if (existingProfile) {
      await db.from('staff_profiles').update(profilePayload).eq('id', existingProfile.id)
    } else {
      await db.from('staff_profiles').insert(profilePayload)
    }

    if (ministryId) {
      const { data: memberRole } = await db.from('ministry_roles').select('id').eq('ministry_id', ministryId).eq('name', 'Membro').maybeSingle()
      await db.from('ministry_members').upsert({
        ministry_id: ministryId,
        person_id: personId,
        ministry_role_id: memberRole?.id ?? null,
        active: true,
        joined_at: now,
      }, { onConflict: 'ministry_id,person_id' })
    }

    await db.from('staff_applications').update({
      status: 'aprovado',
      reviewed_at: now,
      reviewed_by: actingUser?.id ?? null,
      dh_finalized_at: now,
      dh_finalized_by: actingUser?.id ?? null,
    }).eq('id', id)

    await db.from('person_status_history').insert({
      person_id: personId,
      status: 'obreiro',
      started_at: now,
      created_by: actingUser?.id ?? null,
    })

    redir(`/${slug}/pessoas?tab=obreiros&flash_success=${encodeURIComponent('Obreiro finalizado — acesso criado com sucesso')}`)
  }

  async function disponibilizarFormulario(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const db = adm()
    const { headers: hdrs } = await import('next/headers')

    const interestFormId = formData.get('interest_form_id') as string

    // Busca o interest form e a escola
    const { data: form } = await db
      .from('school_interest_forms')
      .select('id, organization_id, full_name, email, phone, language, school_id, class_id, schools(id, name, contact_email)')
      .eq('id', interestFormId)
      .single()

    if (!form) return { error: 'not_found' }

    const escola = form.schools as unknown as {
      id: string; name: string; contact_email: string | null
    } | null

    // Cria ou reutiliza school_applications
    const { data: existing } = await db
      .from('school_applications')
      .select('id, token, token_expires_at')
      .eq('interest_form_id', interestFormId)
      .in('status', ['rascunho', 'enviado'])
      .maybeSingle()

    let token: string
    let expiresAt: string

    if (existing) {
      token = existing.token
      expiresAt = existing.token_expires_at
    } else {
      const { data: newApp } = await db
        .from('school_applications')
        .insert({
          interest_form_id: interestFormId,
          organization_id: (form as unknown as { organization_id: string }).organization_id,
          school_id: form.school_id,
          class_id: form.class_id,
          status: 'rascunho',
          form_data: {
            prefill: {
              nome: form.full_name,
              email: form.email,
              telefone: form.phone,
              idioma: (form as unknown as { language?: string }).language,
            }
          },
        })
        .select('token, token_expires_at')
        .single()
      if (!newApp) return { error: 'Não foi possível criar o formulário.' }
      token = newApp.token
      expiresAt = newApp.token_expires_at
    }

    // Monta URL
    const headersList = await hdrs()
    const host = headersList.get('host') ?? 'localhost:3000'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const formUrl = `${protocol}://${host}/${slug}/formulario/${token}`

    // Tenta enviar e-mail somente se a escola tiver e-mail configurado
    let emailWarning: string | undefined
    if (escola?.contact_email) {
      const { sendFormEmail } = await import('@/lib/email/sendFormEmail')
      const emailResult = await sendFormEmail({
        to: form.email,
        candidateName: form.full_name,
        schoolName: escola.name,
        formUrl,
        expiresAt,
        replyTo: escola.contact_email,
        language: (form as unknown as { language?: string }).language,
        organizationId: (form as unknown as { organization_id: string }).organization_id,
        schoolId: escola.id,
      })
      if (!emailResult.success) {
        emailWarning = emailResult.error === 'quota_atingida' ? 'quota_atingida' : 'email_falhou'
      }
    } else {
      emailWarning = 'sem_email_eted'
    }

    // Atualiza status do interest form
    await db.from('school_interest_forms')
      .update({ status: 'formulario_enviado' })
      .eq('id', interestFormId)

    // Sempre retorna o link — e-mail é opcional
    return { url: formUrl, emailWarning, schoolId: escola?.id }
  }

  async function criarPreInscricaoManual(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const db = adm()

    const classIdVal = (formData.get('class_id') as string | null) || null
    let schoolIdVal: string | null = null

    if (classIdVal) {
      const { data: cls } = await db.from('school_classes').select('school_id').eq('id', classIdVal).single()
      schoolIdVal = cls?.school_id ?? null
    }

    // Fallback: usar primeira escola disponível da org
    if (!schoolIdVal) {
      const { data: school } = await db.from('schools')
        .select('id').eq('organization_id', orgId).in('school_type', [...SCHOOL_APPLICATION_TYPES]).limit(1).single()
      schoolIdVal = school?.id ?? null
    }

    if (!schoolIdVal) return

    await db.from('school_interest_forms').insert({
      organization_id: orgId,
      school_id: schoolIdVal,
      class_id: classIdVal,
      full_name: (formData.get('full_name') as string).trim(),
      email: (formData.get('email') as string)?.trim() || null,
      phone: (formData.get('phone') as string)?.trim() || null,
      message: (formData.get('message') as string)?.trim() || null,
      status: 'pendente',
    })

    const { revalidatePath } = await import('next/cache')
    revalidatePath(`/${slug}/inscricoes`)
  }

  async function editarPreInscricao(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { revalidatePath } = await import('next/cache')
    const db = adm()

    const id = formData.get('id') as string
    const classIdVal = (formData.get('class_id') as string | null) || null
    let schoolIdVal: string | null = null

    if (classIdVal) {
      const { data: cls } = await db.from('school_classes').select('school_id').eq('id', classIdVal).single()
      schoolIdVal = cls?.school_id ?? null
    }

    const update: Record<string, unknown> = {
      full_name: (formData.get('full_name') as string).trim(),
      email: (formData.get('email') as string)?.trim() || null,
      phone: (formData.get('phone') as string)?.trim() || null,
      message: (formData.get('message') as string)?.trim() || null,
      class_id: classIdVal,
    }
    if (schoolIdVal) update.school_id = schoolIdVal

    await db.from('school_interest_forms').update(update).eq('id', id)
    revalidatePath(`/${slug}/inscricoes`)
  }

  async function marcarRecebidoExternamente(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { revalidatePath } = await import('next/cache')
    const db = adm()

    const interestFormId = formData.get('interest_form_id') as string
    const { data: form } = await db
      .from('school_interest_forms')
      .select('id, organization_id, school_id, class_id')
      .eq('id', interestFormId)
      .single()
    if (!form) return

    // Garante school_id: tenta buscar pela org se estiver nulo
    let schoolId: string | null = form.school_id
    if (!schoolId) {
      const { data: school } = await db
        .from('schools')
        .select('id')
        .eq('organization_id', form.organization_id)
        .in('school_type', [...SCHOOL_APPLICATION_TYPES])
        .limit(1)
        .single()
      schoolId = school?.id ?? null
    }
    if (!schoolId) return

    // Verifica se já existe uma application
    const { data: existing } = await db
      .from('school_applications')
      .select('id, status')
      .eq('interest_form_id', interestFormId)
      .maybeSingle()

    if (existing) {
      // Se está em rascunho (ex: form enviado mas não preenchido), promove para em_analise
      if (['rascunho', 'enviado'].includes(existing.status)) {
        await db.from('school_applications')
          .update({ status: 'em_analise' })
          .eq('id', existing.id)
      }
    } else {
      const { error: insertError } = await db.from('school_applications').insert({
        organization_id: form.organization_id,
        school_id: schoolId,
        class_id: form.class_id,
        interest_form_id: form.id,
        status: 'em_analise',
        form_data: { source: 'externo' },
      })
      if (insertError) return
    }

    await db.from('school_interest_forms')
      .update({ status: 'em_analise' })
      .eq('id', interestFormId)

    revalidatePath(`/${slug}/inscricoes`)
  }

  async function disponibilizarFormularioObreiro(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { createClient } = await import('@/lib/supabase/server')
    const { headers: hdrs } = await import('next/headers')
    const db = adm()
    const authClient = await createClient()

    const interestFormId = formData.get('interest_form_id') as string
    const { data: { user } } = await authClient.auth.getUser()

    const { data: form } = await db
      .from('staff_interest_forms')
      .select('id, organization_id, full_name, email, phone, language, ministry_id, person_id')
      .eq('id', interestFormId)
      .single()

    if (!form) return { error: 'not_found' }

    const { data: existing } = await db
      .from('staff_applications')
      .select('id, token, token_expires_at')
      .eq('interest_form_id', interestFormId)
      .in('status', ['rascunho', 'enviado'])
      .maybeSingle()

    let token: string
    let expiresAt: string

    if (existing) {
      token = existing.token!
      expiresAt = existing.token_expires_at!
    } else {
      let personId = form.person_id
      if (!personId) {
        const { data: contact } = await db.from('person_contacts')
          .select('person_id').eq('type', 'email').eq('value', form.email).maybeSingle()
        if (contact) personId = contact.person_id
      }
      if (!personId) {
        const { data: person } = await db.from('people')
          .insert({ organization_id: form.organization_id, full_name: form.full_name })
          .select('id').single()
        personId = person?.id ?? null
        if (personId) {
          await db.from('person_contacts').insert({ person_id: personId, type: 'email', value: form.email, is_primary: true })
        }
      }
      if (!personId) return { error: 'Não foi possível criar a pessoa.' }

      const { data: newApp } = await db
        .from('staff_applications')
        .insert({
          interest_form_id: interestFormId,
          organization_id: form.organization_id,
          person_id: personId,
          ministry_id: form.ministry_id,
          status: 'rascunho',
          form_data: {
            prefill: {
              nome: form.full_name,
              email: form.email,
              telefone: form.phone,
              idioma: form.language,
            }
          },
          leader_accepted_by: user?.id ?? null,
          leader_accepted_at: new Date().toISOString(),
        })
        .select('token, token_expires_at')
        .single()
      if (!newApp) return { error: 'Não foi possível criar o formulário.' }
      token = newApp.token!
      expiresAt = newApp.token_expires_at!
    }

    const headersList = await hdrs()
    const host = headersList.get('host') ?? 'localhost:3000'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const formUrl = `${protocol}://${host}/${slug}/formulario-obreiro/${token}`

    await db.from('staff_interest_forms')
      .update({ status: 'formulario_enviado' })
      .eq('id', interestFormId)

    return { url: formUrl }
  }

  async function criarPreInscricaoObreiroManual(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { revalidatePath } = await import('next/cache')
    const db = adm()

    const ministryIdVal = (formData.get('ministry_id') as string | null) || null

    await db.from('staff_interest_forms').insert({
      organization_id: orgId,
      ministry_id: ministryIdVal,
      full_name: (formData.get('full_name') as string).trim(),
      email: (formData.get('email') as string)?.trim() || '',
      phone: (formData.get('phone') as string)?.trim() || null,
      message: (formData.get('message') as string)?.trim() || null,
      status: 'pendente',
    })

    revalidatePath(`/${slug}/inscricoes`)
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  const items: InscricaoItem[] = []
  const historico: HistoricoItem[] = []

  // Pré-inscrições ativas
  if (tab === 'todas' || tab === 'pre_inscricao') {
    type IFRaw = {
      id: string; full_name: string; email: string; phone: string | null
      message: string | null; status: string; created_at: string; responded_at: string | null; refusal_reason: string | null; reviewed_by: string | null
      class_id: string | null
      schools: { id: string; name: string } | null; school_classes: { name: string } | null
      school_applications: { id: string; status: string; form_data: Record<string, unknown> | null }[] | null
    }
    const result = await sb
      .from('school_interest_forms')
      .select('id, class_id, full_name, email, phone, message, status, created_at, responded_at, refusal_reason, reviewed_by, schools(id, name), school_classes(name), school_applications(id, status, form_data)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    let rows: unknown[] = result.data ?? []

    if (result.error) {
      const fallback = await sb
        .from('school_interest_forms')
        .select('id, class_id, full_name, email, phone, message, status, created_at, responded_at, refusal_reason, schools(id, name), school_classes(name)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
      rows = fallback.data ?? []
    }

    for (const r of (rows as IFRaw[])) {
      const escola = r.schools as { id: string; name: string } | null
      const appRow = (r.school_applications ?? []).find(a => ['enviado', 'em_analise', 'aprovado'].includes(a.status))

      if (isFinalizado(r.status) && r.refusal_reason) {
        historico.push({
          id: r.id, tipo: 'Pré-inscrição', nome: r.full_name,
          escola: escola?.name ?? null,
          motivo: r.refusal_reason,
          recusadoPor: null,
          recusadoPorId: r.reviewed_by ?? null,
          recusadoEm: r.responded_at ?? r.created_at,
        })
      } else if (!isFinalizado(r.status) || ver === 'todas') {
        items.push({
          id: r.id, tipo: 'pre_inscricao', tipoLabel: 'Pré-inscrição',
          tipoColor: 'bg-indigo-50 text-indigo-700',
          nome: r.full_name, email: r.email, phone: r.phone ?? null,
          escola: escola?.name ?? null, schoolId: escola?.id ?? null,
          turma: (r.school_classes as { name: string } | null)?.name ?? null,
          classId: r.class_id ?? null,
          mensagem: r.message, status: r.status, notes: null,
          criadoEm: r.created_at, diasAberto: daysAgo(r.created_at), personId: null,
          applicationId: appRow?.id ?? null,
          hasFormData: appRow ? (appRow.form_data !== null && Object.keys(appRow.form_data as object).length > 0) : false,
        })
      }
    }
  }

  // Candidatos a Aluno
  if (tab === 'todas' || tab === 'aluno') {
    type SAraw = {
      id: string; class_id: string | null; status: string; applied_at: string; reviewed_at: string | null; reviewed_by: string | null; notes: string | null; refusal_reason: string | null
      people: { id: string; full_name: string } | null
      schools: { id: string; name: string } | null; school_classes: { name: string } | null
    }
    const { data } = await sb
      .from('student_applications')
      .select('id, class_id, status, applied_at, reviewed_at, reviewed_by, notes, refusal_reason, people(id, full_name), schools(id, name), school_classes(name)')
      .eq('organization_id', orgId)
      .order('applied_at', { ascending: false })

    for (const r of ((data ?? []) as unknown as SAraw[])) {
      const pessoa = r.people as { id: string; full_name: string } | null
      const escola = r.schools as { id: string; name: string } | null
      if (isFinalizado(r.status) && r.refusal_reason) {
        historico.push({
          id: r.id, tipo: 'Candidato a Aluno', nome: pessoa?.full_name ?? '—',
          escola: escola?.name ?? null,
          motivo: r.refusal_reason,
          recusadoPor: null,
          recusadoPorId: r.reviewed_by ?? null,
          recusadoEm: r.reviewed_at ?? r.applied_at,
        })
      } else if (!isFinalizado(r.status) || ver === 'todas') {
        items.push({
          id: r.id, tipo: 'aluno', tipoLabel: 'Candidato a Aluno',
          tipoColor: 'bg-sky-50 text-sky-700',
          nome: pessoa?.full_name ?? '—', email: null, phone: null,
          escola: escola?.name ?? null, schoolId: escola?.id ?? null,
          turma: (r.school_classes as { name: string } | null)?.name ?? null,
          classId: r.class_id ?? null,
          mensagem: null, status: r.status, notes: r.notes ?? null,
          criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
          personId: pessoa?.id ?? null,
        })
      }
    }
  }

  // Pré-inscrições de Obreiro + Candidatos a Obreiro
  if (tab === 'todas' || tab === 'obreiro') {
    // Pré-inscrições de obreiro (staff_interest_forms)
    type SIFRaw = {
      id: string; full_name: string; email: string; phone: string | null
      message: string | null; status: string; created_at: string; responded_at: string | null
      refusal_reason: string | null; reviewed_by: string | null
      ministry_id: string | null; person_id: string | null
      ministries: { name: string } | null
      staff_applications: { id: string; status: string; form_data: Record<string, unknown> | null; token: string | null }[] | null
    }
    const sifResult = await sb
      .from('staff_interest_forms')
      .select('id, full_name, email, phone, message, status, created_at, responded_at, refusal_reason, reviewed_by, ministry_id, person_id, ministries(name), staff_applications(id, status, form_data, token)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    for (const r of ((sifResult.data ?? []) as unknown as SIFRaw[])) {
      const ministry = r.ministries as { name: string } | null
      const appRow = (r.staff_applications ?? []).find(a => ['enviado', 'em_analise', 'aprovado'].includes(a.status))
        ?? (r.staff_applications ?? []).find(a => a.status === 'rascunho')

      if (isFinalizado(r.status) && r.refusal_reason) {
        historico.push({
          id: r.id, tipo: 'Pré-inscrição Obreiro', nome: r.full_name,
          escola: ministry?.name ?? null,
          motivo: r.refusal_reason,
          recusadoPor: null,
          recusadoPorId: r.reviewed_by ?? null,
          recusadoEm: r.responded_at ?? r.created_at,
        })
      } else if (!isFinalizado(r.status) || ver === 'todas') {
        items.push({
          id: r.id, tipo: 'pre_inscricao_obreiro', tipoLabel: 'Pré-inscrição Obreiro',
          tipoColor: 'bg-orange-50 text-orange-700',
          nome: r.full_name, email: r.email, phone: r.phone ?? null,
          escola: ministry?.name ?? null, schoolId: null, turma: null, classId: null,
          mensagem: r.message, status: r.status, notes: null,
          criadoEm: r.created_at, diasAberto: daysAgo(r.created_at),
          personId: r.person_id ?? null,
          ministryId: r.ministry_id,
          staffApplicationId: appRow?.id ?? null,
          hasFormData: appRow ? (appRow.form_data !== null && Object.keys(appRow.form_data as object).length > 1) : false,
        })
      }
    }

    // Candidatos a Obreiro (staff_applications sem interest_form ou com formulário preenchido)
    type StaffRaw = {
      id: string; ministry_id: string | null; interest_form_id: string | null; status: string; applied_at: string; reviewed_at: string | null; reviewed_by: string | null; refusal_reason: string | null; notes: string | null; form_data: Record<string, unknown> | null
      people: { id: string; full_name: string } | null
      ministries: { name: string } | null
    }
    const result = await sb
      .from('staff_applications')
      .select('id, ministry_id, interest_form_id, status, applied_at, reviewed_at, reviewed_by, refusal_reason, notes, form_data, people(id, full_name), ministries(name)')
      .eq('organization_id', orgId)
      .order('applied_at', { ascending: false })

    let rows: unknown[] = result.data ?? []

    if (result.error) {
      const fallback = await sb
        .from('staff_applications')
        .select('id, ministry_id, interest_form_id, status, applied_at, reviewed_at, reviewed_by, notes, form_data, people(id, full_name), ministries(name)')
        .eq('organization_id', orgId)
        .order('applied_at', { ascending: false })
      rows = fallback.data ?? []
    }

    const staffPersonIds = (rows as StaffRaw[])
      .map(row => row.people?.id)
      .filter((id): id is string => Boolean(id))
    const staffEmailsByPerson = new Map<string, string>()
    const staffLoginByPerson = new Set<string>()

    if (staffPersonIds.length > 0) {
      const [{ data: contacts }, { data: profiles }] = await Promise.all([
        sb.from('person_contacts')
          .select('person_id, value')
          .in('person_id', staffPersonIds)
          .eq('type', 'email')
          .order('is_primary', { ascending: false }),
        sb.from('staff_profiles')
          .select('person_id, user_id')
          .in('person_id', staffPersonIds),
      ])

      for (const contact of (contacts ?? []) as Array<{ person_id: string; value: string }>) {
        if (!staffEmailsByPerson.has(contact.person_id)) staffEmailsByPerson.set(contact.person_id, contact.value)
      }
      for (const profile of (profiles ?? []) as Array<{ person_id: string; user_id: string | null }>) {
        if (profile.user_id) staffLoginByPerson.add(profile.person_id)
      }
    }

    // Só adiciona staff_applications que NÃO vieram de um interest_form (evita duplicata)
    // OU que já estão com status enviado/em_analise (o candidato já preencheu)
    for (const r of (rows as StaffRaw[])) {
      const pessoa = r.people as { id: string; full_name: string } | null
      const ministry = r.ministries as { name: string } | null

      // Se veio de interest_form e está em rascunho, já aparece como pré-inscrição acima
      if (r.interest_form_id && r.status === 'rascunho') continue

      if (isFinalizado(r.status) && r.refusal_reason) {
        historico.push({
          id: r.id, tipo: 'Candidato a Obreiro', nome: pessoa?.full_name ?? '—',
          escola: null,
          motivo: r.refusal_reason,
          recusadoPor: null,
          recusadoPorId: r.reviewed_by ?? null,
          recusadoEm: r.reviewed_at ?? r.applied_at,
        })
      } else if (!isFinalizado(r.status) || ver === 'todas') {
        items.push({
          id: r.id, tipo: 'obreiro', tipoLabel: 'Candidato a Obreiro',
          tipoColor: 'bg-amber-50 text-amber-700',
          nome: pessoa?.full_name ?? '—', email: pessoa?.id ? staffEmailsByPerson.get(pessoa.id) ?? null : null, phone: null,
          escola: ministry?.name ?? null, schoolId: null, turma: null, classId: null, mensagem: null,
          status: r.status, notes: r.notes ?? null,
          criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
          personId: pessoa?.id ?? null,
          ministryId: r.ministry_id,
          hasLogin: pessoa?.id ? staffLoginByPerson.has(pessoa.id) : false,
          staffApplicationId: r.id,
          hasFormData: r.form_data !== null && Object.keys(r.form_data as object).length > 1,
        })
      }
    }
  }

  const filtered = (ver === 'todas' ? items : items.filter(i => !isFinalizado(i.status)))
    .filter(i => !q || i.nome.toLowerCase().includes(q.toLowerCase()) || (i.email ?? '').toLowerCase().includes(q.toLowerCase()))
  filtered.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
  const quota = await getEmailQuota()

  const reviewerIds = [...new Set(historico.map(item => item.recusadoPorId).filter((id): id is string => Boolean(id)))]
  const reviewerNames = new Map<string, string>()

  await Promise.all(reviewerIds.map(async (id) => {
    const { data } = await sb.auth.admin.getUserById(id)
    const displayName = getUserDisplayName(data.user)
    if (displayName) reviewerNames.set(id, displayName)
  }))

  for (const item of historico) {
    item.recusadoPor = item.recusadoPorId ? reviewerNames.get(item.recusadoPorId) ?? null : null
  }

  // Histórico: max 30, mais recentes primeiro
  const historicoTab = historico
    .sort((a, b) => new Date(b.recusadoEm).getTime() - new Date(a.recusadoEm).getTime())
    .slice(0, 30)

  return (
    <>
      <Header
        title="Inscrições"
        actions={
          <div className="flex items-center gap-2">
            <NovaPreInscricaoButton
              slug={slug}
              criarAction={criarPreInscricaoManual}
              openClasses={openClasses.map(c => ({
                id: c.id,
                school_id: c.school_id,
                name: c.name,
                starts_at: c.starts_at,
                schoolName: c.schools?.name ?? null,
              }))}
            />
            <Link
              href={`/${slug}/inscricoes?tab=${tab}&ver=${ver === 'todas' ? 'ativas' : 'todas'}`}
              className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              {ver === 'todas' ? (
                <><span className="hidden sm:inline">Ocultar </span>Concluídas</>
              ) : (
                <><span className="hidden sm:inline">Ver todas</span><span className="sm:hidden">+ Concluídas</span></>
              )}
            </Link>
          </div>
        }
      />

      <main className="p-4 md:p-6 space-y-4">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto scrollbar-none">
          {TIPO_TABS.map(t => {
            const count = t.key === 'todas'
              ? items.filter(i => !isFinalizado(i.status)).length
              : t.key === 'obreiro'
                ? items.filter(i => (i.tipo === 'obreiro' || i.tipo === 'pre_inscricao_obreiro') && !isFinalizado(i.status)).length
                : items.filter(i => i.tipo === t.key && !isFinalizado(i.status)).length
            return (
              <Link key={t.key}
                href={`/${slug}/inscricoes?tab=${t.key}&ver=${ver}`}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    tab === t.key ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-500'
                  }`}>{count}</span>
                )}
              </Link>
            )
          })}
        </div>

        <Suspense>
          <SearchBar placeholder="Buscar por nome ou e-mail…" className="w-full sm:w-80" />
        </Suspense>

        {/* Card com link da página /servir — visível na tab Obreiros */}
        {tab === 'obreiro' && <ServirLinkCard slug={slug} />}

        {/* Lista */}
        {!filtered.length ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <ClipboardList className="size-8 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400 text-sm">
              {q ? `Nenhum resultado para "${q}".` : ver === 'ativas' ? 'Nenhuma inscrição ativa.' : 'Nenhuma inscrição encontrada.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const statusInfo = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-500' }
              const urgency    = urgencyBadge(item.diasAberto)
              const finalizado = isFinalizado(item.status)
              const whatsapp   = item.phone ? `https://wa.me/${item.phone.replace(/\D/g, '')}` : null

              return (
                <div key={`${item.tipo}-${item.id}`}
                  className={`bg-white rounded-xl border border-l-4 p-4 transition-opacity ${finalizado ? 'opacity-60' : ''} ${urgencyBorderColor(item.diasAberto)}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.tipoColor}`}>{item.tipoLabel}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${urgency.color}`}>{urgency.label}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>{statusInfo.label}</span>
                      </div>
                      <p className="font-semibold text-gray-900">{item.nome}</p>
                      {(item.email || item.phone) && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {item.email}{item.email && item.phone ? ' · ' : ''}{item.phone}
                        </p>
                      )}
                      {(item.escola || item.turma) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.escola}{item.turma ? ` · ${item.turma}` : ''}
                        </p>
                      )}
                      {item.mensagem && (
                        <p className="text-xs text-gray-500 mt-1.5 italic border-l-2 border-gray-200 pl-2 line-clamp-2">
                          &ldquo;{item.mensagem}&rdquo;
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-400 mt-1 bg-gray-50 px-2 py-1 rounded">Obs: {item.notes}</p>
                      )}
                      {item.tipo === 'pre_inscricao' && item.applicationId && (
                        <Link
                          href={`/${slug}/inscricoes/formulario/${item.applicationId}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-700 mt-1 bg-blue-50 border border-blue-100 px-2 py-1 rounded font-medium hover:bg-blue-100 transition-colors"
                        >
                          <ClipboardList className="size-3.5 inline -mt-0.5" /> Formulário preenchido — Ver respostas
                        </Link>
                      )}
                      {item.tipo === 'pre_inscricao_obreiro' && item.staffApplicationId && item.hasFormData && (
                        <Link
                          href={`/${slug}/inscricoes/formulario-obreiro/${item.staffApplicationId}`}
                          className="inline-flex items-center gap-1 text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded font-medium hover:bg-amber-100 transition-colors"
                        >
                          <ClipboardList className="size-3.5 inline -mt-0.5" /> Formulário preenchido — Ver respostas
                        </Link>
                      )}
                      {item.tipo === 'obreiro' && item.hasFormData && item.staffApplicationId && (
                        <Link
                          href={`/${slug}/inscricoes/formulario-obreiro/${item.staffApplicationId}`}
                          className="inline-flex items-center gap-1 text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded font-medium hover:bg-amber-100 transition-colors"
                        >
                          <ClipboardList className="size-3.5 inline -mt-0.5" /> Ver formulário preenchido
                        </Link>
                      )}
                      {item.tipo === 'obreiro' && item.status === 'em_analise' && !item.hasLogin && (
                        <p className="text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded font-medium">
                          Obreiro sem cadastro
                        </p>
                      )}
                      <p className="text-xs text-gray-300 mt-1.5">
                        {new Date(item.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    {!finalizado && (
                      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-col sm:items-end shrink-0 w-full sm:w-auto">
                        {/* Contato */}
                        {item.email && (
                          <a href={`mailto:${item.email}?subject=Sua inscrição - ${item.escola ?? 'JOCUM'}&body=Olá ${item.nome},%0A%0A`}
                            className="inline-flex items-center justify-center gap-1 text-xs px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                            <Mail className="size-3.5 inline -mt-0.5" /> E-mail
                          </a>
                        )}
                        {whatsapp && (
                          <a href={whatsapp} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1 text-xs px-3 py-2 border border-green-200 text-green-700 hover:bg-green-50 rounded-lg transition-colors">
                            <MessageCircle className="size-3.5 inline -mt-0.5" /> WhatsApp
                          </a>
                        )}
                        {/* Formulário recebido externamente — quando ainda não tem application */}
                        {item.tipo === 'pre_inscricao' && !item.applicationId && (
                          <div className="col-span-2">
                            <MarcarRecebidoExternoButton
                              interestFormId={item.id}
                              externoAction={marcarRecebidoExternamente}
                            />
                          </div>
                        )}

                        {/* Links de recomendação — quando já tem application (digital ou externo) */}
                        {item.tipo === 'pre_inscricao' && item.applicationId && (
                          <div className="col-span-2">
                            <LinksReferenciaAdminButton
                              applicationId={item.applicationId}
                              candidateName={item.nome}
                              slug={slug}
                            />
                          </div>
                        )}

                        {/* Editar pré-inscrição */}
                        {item.tipo === 'pre_inscricao' && (
                          <EditarPreInscricaoButton
                            item={{ id: item.id, full_name: item.nome, email: item.email, phone: item.phone, message: item.mensagem, classId: item.classId }}
                            openClasses={openClasses.map(c => ({ id: c.id, school_id: c.school_id, name: c.name, starts_at: c.starts_at, schoolName: c.schools?.name ?? null }))}
                            editarAction={editarPreInscricao}
                          />
                        )}

                        {/* Disponibilizar formulário — apenas pré-inscrições */}
                        {item.tipo === 'pre_inscricao' && item.schoolId && (
                          <div className="col-span-2">
                            <DisponibilizarFormularioButton
                              interestFormId={item.id}
                              slug={slug}
                              schoolId={item.schoolId}
                              action={disponibilizarFormulario}
                              emailDisabled={quota.exceeded}
                              emailDisabledReason={
                                quota.dailyExceeded
                                  ? 'Limite diário de e-mails atingido (100/dia). O link ainda pode ser copiado.'
                                  : 'Limite mensal de e-mails atingido (3.000/mês). O link ainda pode ser copiado.'
                              }
                            />
                          </div>
                        )}

                        {/* Disponibilizar formulário — pré-inscrição de obreiro */}
                        {item.tipo === 'pre_inscricao_obreiro' && !item.staffApplicationId && (
                          <div className="col-span-2">
                            <DisponibilizarFormularioButton
                              interestFormId={item.id}
                              slug={slug}
                              schoolId="__obreiro__"
                              action={disponibilizarFormularioObreiro}
                              emailDisabled={false}
                              label="Gerar formulário de obreiro"
                            />
                          </div>
                        )}

                        {/* Links de recomendação — obreiro com formulário enviado */}
                        {(item.tipo === 'pre_inscricao_obreiro' || item.tipo === 'obreiro') && item.staffApplicationId && item.hasFormData && (
                          <div className="col-span-2">
                            <LinksReferenciaAdminButton
                              applicationId={item.staffApplicationId}
                              candidateName={item.nome}
                              slug={slug}
                              isStaff
                            />
                          </div>
                        )}

                        <div className="col-span-2 h-px bg-gray-100" />

                        {/* Status */}
                        {item.status === 'pendente' && item.tipo !== 'pre_inscricao_obreiro' && (
                          <form action={updateStatus}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="tipo" value={item.tipo} />
                            <input type="hidden" name="status" value="em_contato" />
                            <button type="submit" className="w-full text-xs px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors">
                              Em contato
                            </button>
                          </form>
                        )}
                        {(item.status === 'pendente' || item.status === 'em_contato' || item.status === 'formulario_enviado' || item.status === 'em_analise') && item.tipo !== 'obreiro' && item.tipo !== 'pre_inscricao_obreiro' && (
                          <form action={aprovar} className="col-span-2 space-y-1.5">
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="tipo" value={item.tipo} />
                            <input type="hidden" name="email" value={item.email ?? ''} />
                            <input type="hidden" name="person_id" value={item.personId ?? ''} />
                            <input type="hidden" name="org_id" value={orgId} />
                            <select
                              name="class_id"
                              defaultValue={item.classId ?? ''}
                              required
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
                            >
                              <option value="" disabled>Selecione a turma ETED</option>
                              {openClasses.map(classOption => (
                                <option key={classOption.id} value={classOption.id}>
                                  {classOption.schools?.name ?? 'ETED'} · {classOption.name}
                                  {classOption.starts_at ? ` · ${new Date(classOption.starts_at).toLocaleDateString('pt-BR')}` : ''}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className="w-full text-xs px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors font-semibold">
                              ✓ Aceitar aluno
                            </button>
                          </form>
                        )}
                        {item.tipo === 'aluno' && item.status === 'pendente' && (
                          <form action={updateStatus}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="tipo" value={item.tipo} />
                            <input type="hidden" name="status" value="em_analise" />
                            <button type="submit" className="w-full text-xs px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors">
                              Em análise
                            </button>
                          </form>
                        )}
                        {item.tipo === 'obreiro' && item.status !== 'em_analise' && (
                          <form action={encaminharObreiroDh} className="col-span-2">
                            <input type="hidden" name="id" value={item.id} />
                            <button type="submit" className="w-full text-xs px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors font-semibold">
                              Enviar ao DH
                            </button>
                          </form>
                        )}
                        {item.tipo === 'obreiro' && item.status === 'em_analise' && isManagement && item.personId && (
                          <form action={finalizarObreiro} className="col-span-2 space-y-1.5 rounded-lg border border-amber-100 bg-amber-50 p-2">
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="org_id" value={orgId} />
                            <input type="hidden" name="person_id" value={item.personId} />
                            <input type="hidden" name="ministry_id" value={item.ministryId ?? ''} />
                            <input type="hidden" name="name" value={item.nome} />
                            <p className="text-xs font-semibold text-amber-800">Obreiro sem cadastro</p>
                            <input
                              name="email"
                              type="email"
                              defaultValue={item.email ?? ''}
                              required
                              placeholder="E-mail de login"
                              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                            />
                            <input
                              name="password"
                              type="password"
                              required
                              minLength={6}
                              placeholder="Senha temporária"
                              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                            />
                            <button type="submit" className="w-full text-xs px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-semibold">
                              Finalizar obreiro
                            </button>
                          </form>
                        )}
                        <div className="col-span-2 sm:col-span-1">
                          <RecusarModal id={item.id} tipo={item.tipo} action={recusar} />
                        </div>
                      </div>
                    )}

                    {finalizado && <div className="shrink-0 text-xs text-gray-300 sm:text-right">concluído</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Histórico de Recusas ──────────────────────────────────────────── */}
        {historicoTab.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer flex items-center gap-2 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 select-none list-none">
              <span className="transition-transform group-open:rotate-90">▶</span>
              Histórico de recusas ({historicoTab.length})
            </summary>
            <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                    <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Escola</th>
                    <th className="hidden lg:table-cell text-left px-4 py-3 font-medium text-gray-600">Recusado por</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historicoTab.map(h => (
                    <tr key={`hist-${h.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{h.nome}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(h.recusadoEm).toLocaleDateString('pt-BR')}
                        </p>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-xs text-gray-500">{h.tipo}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-gray-500">{h.escola ?? '—'}</td>
                      <td className="hidden lg:table-cell px-4 py-3 text-xs text-gray-500">{h.recusadoPor ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                        <p className="line-clamp-2" title={h.motivo}>{h.motivo}</p>
                        <p className="mt-1 text-[11px] text-gray-400 lg:hidden">
                          Recusado por: {h.recusadoPor ?? '—'}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

      </main>
    </>
  )
}
