import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound } from 'next/navigation'
import { ClipboardList, Mail, MessageCircle } from 'lucide-react'
import { NovaPreInscricaoButton, NovaPreInscricaoObreiroButton, EditarPreInscricaoButton, EditarPreInscricaoObreiroButton, MarcarRecebidoExternoButton, LinksReferenciaAdminButton } from './InscricoesModals'
import { RecusarModal } from './RecusarModal'
import { DisponibilizarFormularioButton } from './DisponibilizarFormularioButton'
import { getEmailQuota } from '@/lib/email/getEmailQuota'
import { getRolePreview } from '@/lib/role-preview'
import { Suspense } from 'react'
import { ScrollHighlight } from '@/components/ui/ScrollHighlight'
import { SCHOOL_APPLICATION_TYPES } from '@/lib/schools'
import { ServirLinkCard } from './ServirLinkCard'
import { InscricaoLinkCard } from './InscricaoLinkCard'
import { MinistryLinkCard } from './MinistryLinkCard'
import { InscricoesList } from './InscricoesList'
import { SearchBar } from '@/components/ui/SearchBar'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string; etapa?: string; q?: string; flash_success?: string }>
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
  diasNaEtapaAtual: number
  personId: string | null
  ministryId?: string | null
  hasLogin?: boolean
  applicationId?: string | null
  staffApplicationId?: string | null
  hasFormData?: boolean
  bgCheckSummary?: BgCheckSummary | null
  backgroundChecks?: BackgroundCheckRow[]
  assumedByName?: string | null
  refSummary?: RefSummary | null
  pastorSkipped?: boolean
  hospedagemSkipped?: boolean
  hospedagemResolved?: boolean
  hospedagemStatus?: string | null
  hospedagemArrivalDate?: string | null
  hospedagemDepartureDate?: string | null
  candidateArrivalDate?: string | null
}

type BackgroundCheckRow = { id: string; check_type: string; country: string | null; status: string; issued_at: string | null; expires_at: string | null; notes: string | null; flagged_concern: boolean }

type BgCheckSummary = { total: number; pendentes: number; reprovados: number; flagged: number; expirados: number }
type RefEntry = { status: string; data: Record<string, string> | null }
type RefSummary = { pastor: RefEntry | null; amigo: RefEntry | null }

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

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}
const isFinalizado = (s: string) => ['convertido','aprovado','descartado','reprovado','cancelado'].includes(s)

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente:           { label: 'Pendente',      color: 'bg-yellow-100 text-yellow-700' },
  formulario_enviado: { label: 'Form. enviado', color: 'bg-blue-100 text-blue-700' },
  em_contato:         { label: 'Em contato',    color: 'bg-purple-100 text-purple-700' },
  em_analise:         { label: 'Em análise',    color: 'bg-blue-100 text-blue-700' },
  convertido:         { label: 'Convertido',    color: 'bg-green-100 text-green-700' },
  aprovado:           { label: 'Aprovado',      color: 'bg-green-100 text-green-700' },
  reprovado:          { label: 'Reprovado',     color: 'bg-red-100 text-red-700' },
  descartado:         { label: 'Recusado',      color: 'bg-gray-100 text-gray-500' },
  cancelado:          { label: 'Cancelado',     color: 'bg-gray-100 text-gray-500' },
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
  const { tab = 'todas', etapa = 'todas', q } = await searchParams

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
  const isLiderMinisterio = userRole === 'lider_ministerio'
  const isManagement = ['superadmin', 'admin_base', 'lider_base', 'dh'].includes(userRole)
  const canWrite = ['superadmin', 'admin_base', 'dh'].includes(userRole)

  let leaderMinistryId: string | null = null
  if (isLiderMinisterio) {
    leaderMinistryId = preview?.ministryId
      ?? (await supabase.from('ministry_leaders').select('ministry_id').eq('user_id', user?.id ?? '').limit(1).single()).data?.ministry_id ?? null
  }

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

  const canWriteEted = isEtedLeader && (allowedSchoolIds?.length ?? 0) > 0
  const canWriteObreiro = canWrite || isLiderMinisterio || canWriteEted

  const canWriteItem = (item: InscricaoItem) => {
    if (canWrite) return true
    if (canWriteEted && item.schoolId && allowedSchoolIds!.includes(item.schoolId)) return true
    return false
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
    const tabRedirect = (tipo === 'pre_inscricao' || tipo === 'aluno') ? 'aluno' : 'obreiro'
    const etapaRedirect = (tipo === 'pre_inscricao' || tipo === 'pre_inscricao_obreiro') ? 'pre_inscricao' : 'candidatura'
    redir(`/${slug}/inscricoes?tab=${tabRedirect}&etapa=${etapaRedirect}&flash_success=${encodeURIComponent(label)}`)
  }

  async function assumirPreInscricaoObreiro(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { createClient } = await import('@/lib/supabase/server')
    const { redirect: redir } = await import('next/navigation')
    const db = adm()
    const authClient = await createClient()
    const id = formData.get('id') as string
    const orgIdForm = formData.get('org_id') as string
    if (!id || !orgIdForm) return

    const { data: { user } } = await authClient.auth.getUser()
    const { data: orgUsers } = await authClient
      .from('organization_users')
      .select('organization_id, roles(name)')
      .eq('user_id', user?.id ?? '')
      .eq('active', true)
    const memberships = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
    const role = memberships.find(row => row.roles?.name === 'superadmin')?.roles?.name
      ?? memberships.find(row => row.organization_id === orgIdForm)?.roles?.name
      ?? ''
    if (!user || !['superadmin', 'admin_base', 'dh'].includes(role)) return

    await db.from('staff_interest_forms').update({
      assumed_by: user.id,
      assumed_at: new Date().toISOString(),
    }).eq('id', id)

    redir(`/${slug}/inscricoes?tab=obreiro&flash_success=${encodeURIComponent('Conversa assumida pelo DH')}`)
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
    const decisionNote = (formData.get('decision_note') as string | null)?.trim() || null
    const decisionNoteShared = formData.get('decision_note_shared') === 'on'
    if (!reason) return
    const now = new Date().toISOString()
    if (tipo === 'pre_inscricao') {
      const { data: row, error } = await db.from('school_interest_forms')
        .update({ status: 'descartado', refusal_reason: reason, responded_at: now, reviewed_at: now, reviewed_by: user?.id ?? null, decision_note: decisionNote, decision_note_shared: decisionNoteShared })
        .eq('id', id)
        .select('email, full_name, school_id, schools(name, contact_email)')
        .single()
      if (error?.code === 'PGRST204') {
        await db.from('school_interest_forms')
          .update({ status: 'descartado', refusal_reason: reason, responded_at: now })
          .eq('id', id)
      }
      const escola = row?.schools as unknown as { name: string; contact_email: string | null } | null
      if (decisionNoteShared && row?.email && escola?.contact_email) {
        const { sendRejectionEmail } = await import('@/lib/email/sendRejectionEmail')
        sendRejectionEmail({
          to: row.email, candidateName: row.full_name, schoolName: escola.name,
          replyTo: escola.contact_email, organizationId: orgId, schoolId: row.school_id ?? '',
          decisionNote,
        }).catch(() => {})
      }
      // Pessoa saiu do processo de entrada — cancela pendência de hospedagem
      // (se existir) ligada à candidatura desse aluno, mesmo padrão do obreiro.
      const { data: alunoApps } = await db.from('school_applications').select('id').eq('interest_form_id', id)
      const alunoAppIds = (alunoApps ?? []).map(a => a.id)
      if (alunoAppIds.length > 0) {
        await db.from('service_requests')
          .update({ status: 'rejeitado', reviewed_at: now, reviewed_by: user?.id ?? null })
          .in('school_application_id', alunoAppIds)
          .eq('request_type', 'hospedagem_aluno')
          .in('status', ['pendente', 'em_analise', 'em_andamento'])
      }
    } else if (tipo === 'pre_inscricao_obreiro') {
      await db.from('staff_interest_forms')
        .update({ status: 'descartado', refusal_reason: reason, responded_at: now, reviewed_at: now, reviewed_by: user?.id ?? null })
        .eq('id', id)
    } else if (tipo === 'aluno') {
      const { data: row } = await db.from('student_applications')
        .update({ status: 'reprovado', refusal_reason: reason, reviewed_at: now, reviewed_by: user?.id ?? null, decision_note: decisionNote, decision_note_shared: decisionNoteShared })
        .eq('id', id)
        .select('person_id, school_id, people(full_name), schools(name, contact_email)')
        .single()
      const escola = row?.schools as unknown as { name: string; contact_email: string | null } | null
      if (decisionNoteShared && row?.person_id && escola?.contact_email) {
        const { data: contact } = await db.from('person_contacts')
          .select('value').eq('person_id', row.person_id).eq('type', 'email')
          .order('is_primary', { ascending: false }).limit(1).maybeSingle()
        if (contact?.value) {
          const { sendRejectionEmail } = await import('@/lib/email/sendRejectionEmail')
          sendRejectionEmail({
            to: contact.value,
            candidateName: (row.people as unknown as { full_name: string } | null)?.full_name ?? 'Candidato',
            schoolName: escola.name, replyTo: escola.contact_email, organizationId: orgId,
            schoolId: row.school_id ?? '', decisionNote,
          }).catch(() => {})
        }
      }
    } else {
      const { error } = await db.from('staff_applications')
        .update({ status: 'reprovado', refusal_reason: reason, reviewed_at: now, reviewed_by: user?.id ?? null })
        .eq('id', id)
      if (error?.code === 'PGRST204') {
        await db.from('staff_applications')
          .update({ status: 'reprovado', reviewed_at: now, reviewed_by: user?.id ?? null })
          .eq('id', id)
      }
      // Pessoa saiu do processo de entrada — cancela a pendência de
      // hospedagem (se existir) pra parar de ocupar a fila da hospitalidade
      // e a necessidade de quarto/alojamento associada a ela.
      await db.from('service_requests')
        .update({ status: 'rejeitado', reviewed_at: now, reviewed_by: user?.id ?? null })
        .eq('staff_application_id', id)
        .eq('request_type', 'hospedagem_obreiro')
        .in('status', ['pendente', 'em_analise', 'em_andamento'])
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
    const decisionNote = (formData.get('decision_note') as string | null)?.trim() || null
    const decisionNoteShared = formData.get('decision_note_shared') === 'on'
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
        .update({ status: 'convertido', responded_at: now, reviewed_at: now, reviewed_by: actingUser?.id ?? null, class_id: classId, decision_note: decisionNote, decision_note_shared: decisionNoteShared })
        .eq('id', id)
      if (error?.code === 'PGRST204') {
        await db.from('school_interest_forms').update({ status: 'convertido', responded_at: now, class_id: classId }).eq('id', id)
      }
    } else if (tipo === 'aluno') {
      await db.from('student_applications')
        .update({ status: 'aprovado', reviewed_at: now, reviewed_by: actingUser?.id ?? null, class_id: classId, decision_note: decisionNote, decision_note_shared: decisionNoteShared })
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
            decisionNote: decisionNoteShared ? decisionNote : null,
          }).catch(() => {})
        }
      }
    }

    const { redirect: redir } = await import('next/navigation')
    redir(`/${slug}/pessoas?tab=alunos&flash_success=${encodeURIComponent('Aluno aprovado e adicionado à turma')}`)
  }

  // O envio do formulário definitivo já leva a candidatura direto pra
  // 'em_analise' (formulario-obreiro/[token]/actions.ts) — o líder não
  // precisa mais "encaminhar ao DH" manualmente. Isso só guarda a palavra
  // opcional do líder sobre receber a pessoa, sem mexer em status.
  async function salvarPalavraLider(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { createClient } = await import('@/lib/supabase/server')
    const db = adm()
    const authClient = await createClient()
    const id = formData.get('id') as string
    const leaderWord = (formData.get('leader_word') as string | null)?.trim() || null
    const leaderWordShared = formData.get('leader_word_shared') === 'on'
    const { data: { user } } = await authClient.auth.getUser()
    if (!id || !user) return
    await db.from('staff_applications').update({
      leader_accepted_at: new Date().toISOString(),
      leader_accepted_by: user.id,
      leader_word: leaderWord,
      leader_word_shared: leaderWordShared,
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

    const { data: pastorRef } = await db.from('reference_forms')
      .select('status').eq('staff_application_id', id).eq('type', 'pastor').maybeSingle()
    const { data: skipRow } = await db.from('staff_applications')
      .select('pastor_reference_skip_reason, hospedagem_skip_reason, leader_word, leader_word_shared').eq('id', id).maybeSingle()
    if (pastorRef?.status !== 'enviado' && !skipRow?.pastor_reference_skip_reason) {
      redir(`/${slug}/inscricoes?tab=obreiro&flash_error=${encodeURIComponent('Referência do pastor pendente — aguarde a resposta ou registre uma justificativa para pular esta etapa.')}`)
      return
    }

    const { data: hospRequest } = await db.from('service_requests')
      .select('status').eq('staff_application_id', id).eq('request_type', 'hospedagem_obreiro')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (hospRequest?.status !== 'resolvido' && !skipRow?.hospedagem_skip_reason) {
      redir(`/${slug}/inscricoes?tab=obreiro&flash_error=${encodeURIComponent('Hospedagem pendente — aguarde a resposta da hospitalidade ou registre uma justificativa para pular esta etapa.')}`)
      return
    }

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

    // E-mail de aprovação — best-effort, não bloqueia o redirect
    const { data: orgRow } = await db.from('organizations').select('name, email').eq('id', orgIdForm).maybeSingle()
    let ministryName: string | null = null
    if (ministryId) {
      const { data: ministryRow } = await db.from('ministries').select('name').eq('id', ministryId).maybeSingle()
      ministryName = ministryRow?.name ?? null
    }
    const { sendStaffApprovalEmail } = await import('@/lib/email/sendStaffApprovalEmail')
    sendStaffApprovalEmail({
      to: email,
      candidateName: (formData.get('name') as string | null) || 'Obreiro',
      organizationName: orgRow?.name ?? 'JOCUM',
      ministryName,
      replyTo: orgRow?.email || 'noreply@sisgomission.com',
      organizationId: orgIdForm,
      leaderWord: skipRow?.leader_word_shared ? skipRow.leader_word : null,
    }).catch(() => {})

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

  async function editarPreInscricaoObreiro(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { revalidatePath } = await import('next/cache')
    const db = adm()
    const id = formData.get('id') as string
    const destination = (formData.get('destination') as string) || ''
    const [destType, destId] = destination.includes(':') ? destination.split(':') : [null, null]
    await db.from('staff_interest_forms').update({
      full_name: (formData.get('full_name') as string).trim(),
      email: (formData.get('email') as string)?.trim() || null,
      phone: (formData.get('phone') as string)?.trim() || null,
      message: (formData.get('message') as string)?.trim() || null,
      ministry_id: destType === 'ministry' ? destId : null,
      school_id: destType === 'school' ? destId : null,
    }).eq('id', id)
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

  async function marcarRecebidoExternamenteObreiro(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { revalidatePath } = await import('next/cache')
    const { createClient } = await import('@/lib/supabase/server')
    const db = adm()
    const authClient = await createClient()
    const { data: { user: currentUser } } = await authClient.auth.getUser()

    const interestFormId = formData.get('interest_form_id') as string
    const { data: form } = await db
      .from('staff_interest_forms')
      .select('id, organization_id, ministry_id, school_id')
      .eq('id', interestFormId)
      .single()
    if (!form) return

    const { data: existing } = await db
      .from('staff_applications')
      .select('id, status')
      .eq('interest_form_id', interestFormId)
      .maybeSingle()

    if (existing) {
      if (['rascunho', 'enviado'].includes(existing.status)) {
        await db.from('staff_applications').update({ status: 'em_analise' }).eq('id', existing.id)
      }
    } else {
      await db.from('staff_applications').insert({
        organization_id: form.organization_id,
        ministry_id: form.ministry_id,
        school_id: form.school_id,
        interest_form_id: form.id,
        status: 'em_analise',
        form_data: { source: 'externo' },
        applied_at: new Date().toISOString(),
        reviewed_by: currentUser?.id ?? null,
      })
    }

    await db.from('staff_interest_forms')
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
      .select('id, organization_id, full_name, email, phone, language, ministry_id, school_id, person_id')
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
      if (!personId && form.email) {
        const { data: contact } = await db.from('person_contacts')
          .select('person_id').eq('type', 'email').eq('value', form.email).maybeSingle()
        if (contact) personId = contact.person_id
      }
      if (!personId && !form.email && form.phone) {
        const { data: contact } = await db.from('person_contacts')
          .select('person_id').eq('type', 'phone').eq('value', form.phone).maybeSingle()
        if (contact) personId = contact.person_id
      }
      if (!personId) {
        const { data: person } = await db.from('people')
          .insert({ organization_id: form.organization_id, full_name: form.full_name })
          .select('id').single()
        personId = person?.id ?? null
        if (personId) {
          if (form.email) {
            await db.from('person_contacts').insert({ person_id: personId, type: 'email', value: form.email, is_primary: true })
          } else if (form.phone) {
            await db.from('person_contacts').insert({ person_id: personId, type: 'phone', value: form.phone, is_primary: true })
          }
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
          school_id: form.school_id,
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

    // Tenta enviar e-mail — usa o e-mail da organização (ou do ministério, se houver) como reply-to
    let emailWarning: string | undefined
    if (form.email) {
      const { data: orgRow } = await db.from('organizations').select('name, email').eq('id', form.organization_id).maybeSingle()
      let ministryName: string | null = null
      if (form.ministry_id) {
        const { data: ministryRow } = await db.from('ministries').select('name').eq('id', form.ministry_id).maybeSingle()
        ministryName = ministryRow?.name ?? null
      }
      const { sendFormEmail } = await import('@/lib/email/sendFormEmail')
      const emailResult = await sendFormEmail({
        to: form.email,
        candidateName: form.full_name,
        schoolName: ministryName ?? orgRow?.name ?? 'JOCUM',
        formUrl,
        expiresAt,
        replyTo: orgRow?.email || 'noreply@sisgomission.com',
        language: form.language,
        organizationId: form.organization_id,
      })
      if (!emailResult.success) {
        emailWarning = emailResult.error === 'quota_atingida' ? 'quota_atingida' : 'email_falhou'
      }
    } else {
      emailWarning = 'sem_email_candidato'
    }

    await db.from('staff_interest_forms')
      .update({ status: 'formulario_enviado' })
      .eq('id', interestFormId)

    return { url: formUrl, emailWarning }
  }

  async function criarPreInscricaoObreiroManual(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { revalidatePath } = await import('next/cache')
    const db = adm()

    const destination = (formData.get('destination') as string) || ''
    const [destType, destId] = destination.includes(':') ? destination.split(':') : [null, null]

    await db.from('staff_interest_forms').insert({
      organization_id: orgId,
      ministry_id: destType === 'ministry' ? destId : null,
      school_id: destType === 'school' ? destId : null,
      full_name: (formData.get('full_name') as string).trim(),
      email: (formData.get('email') as string)?.trim() || '',
      phone: (formData.get('phone') as string)?.trim() || null,
      message: (formData.get('message') as string)?.trim() || null,
      status: 'pendente',
    })

    revalidatePath(`/${slug}/inscricoes`)
  }

  async function encaminharParaEscola(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const db = adm()
    const interestId = formData.get('interest_id') as string
    const schoolId = formData.get('school_id') as string
    if (!interestId || !schoolId) return
    await db.from('school_interest_forms').update({ school_id: schoolId }).eq('id', interestId)
    const { redirect: redir } = await import('next/navigation')
    redir(`/${slug}/inscricoes?flash_success=${encodeURIComponent('Inscrição encaminhada para a escola.')}`)
  }

  async function encaminharParaMinisterio(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const db = adm()
    const interestId = formData.get('interest_id') as string
    const destination = (formData.get('destination') as string) || ''
    const [destType, destId] = destination.includes(':') ? destination.split(':') : [null, null]
    if (!interestId || !destId) return
    await db.from('staff_interest_forms').update({
      ministry_id: destType === 'ministry' ? destId : null,
      school_id: destType === 'school' ? destId : null,
    }).eq('id', interestId)
    const { redirect: redir } = await import('next/navigation')
    redir(`/${slug}/inscricoes?tab=obreiro&flash_success=${encodeURIComponent('Inscrição encaminhada.')}`)
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  const [{ data: allSchoolsRaw }, { data: allMinistriesRaw }, { data: publicSchoolsRaw }, { data: publicMinistriesRaw }] = await Promise.all([
    sb.from('schools').select('id, name').eq('organization_id', orgId).eq('active', true).order('name'),
    sb.from('ministries').select('id, name').eq('organization_id', orgId).eq('active', true).order('name'),
    sb.from('schools').select('id, name, slug').eq('organization_id', orgId).eq('active', true).eq('is_public', true).in('school_type', [...SCHOOL_APPLICATION_TYPES]).order('name'),
    sb.from('ministries').select('id, name, slug').eq('organization_id', orgId).eq('active', true).eq('is_public', true).order('name'),
  ])
  const allSchools = (allSchoolsRaw ?? []) as Array<{ id: string; name: string }>
  const allMinistries = (allMinistriesRaw ?? []) as Array<{ id: string; name: string }>
  const publicSchools = (publicSchoolsRaw ?? []).filter((s: { slug: string | null }) => s.slug) as Array<{ id: string; name: string; slug: string }>
  const publicMinistries = (publicMinistriesRaw ?? []).filter((m: { slug: string | null }) => m.slug) as Array<{ id: string; name: string; slug: string }>

  const items: InscricaoItem[] = []
  const historico: HistoricoItem[] = []
  const assumedLookups: { item: InscricaoItem; userId: string }[] = []

  // Pré-inscrições ativas (sempre carrega tudo — filtro de tipo/etapa é feito no cliente, instantâneo)
  {
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
      } else {
        items.push({
          id: r.id, tipo: 'pre_inscricao', tipoLabel: 'Pré-inscrição',
          tipoColor: 'bg-indigo-50 text-indigo-700',
          nome: r.full_name, email: r.email, phone: r.phone ?? null,
          escola: escola?.name ?? null, schoolId: escola?.id ?? null,
          turma: (r.school_classes as { name: string } | null)?.name ?? null,
          classId: r.class_id ?? null,
          mensagem: r.message, status: r.status, notes: null,
          criadoEm: r.created_at, diasAberto: daysAgo(r.created_at),
          diasNaEtapaAtual: daysAgo(r.responded_at ?? r.created_at),
          personId: null,
          applicationId: appRow?.id ?? null,
          hasFormData: appRow ? (appRow.form_data !== null && Object.keys(appRow.form_data as object).length > 0) : false,
          candidateArrivalDate: (appRow?.form_data as Record<string, Record<string, string>> | undefined)?.s4?.data_chegada || null,
        })
      }
    }
  }

  // Candidatos a Aluno
  {
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
      } else {
        items.push({
          id: r.id, tipo: 'aluno', tipoLabel: 'Candidato a Aluno',
          tipoColor: 'bg-sky-50 text-sky-700',
          nome: pessoa?.full_name ?? '—', email: null, phone: null,
          escola: escola?.name ?? null, schoolId: escola?.id ?? null,
          turma: (r.school_classes as { name: string } | null)?.name ?? null,
          classId: r.class_id ?? null,
          mensagem: null, status: r.status, notes: r.notes ?? null,
          criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
          diasNaEtapaAtual: daysAgo(r.reviewed_at ?? r.applied_at),
          personId: pessoa?.id ?? null,
        })
      }
    }
  }

  // Pré-inscrições de Obreiro + Candidatos a Obreiro
  {
    // Pré-inscrições de obreiro (staff_interest_forms)
    type SIFRaw = {
      id: string; full_name: string; email: string; phone: string | null
      message: string | null; status: string; created_at: string; responded_at: string | null
      refusal_reason: string | null; reviewed_by: string | null
      ministry_id: string | null; school_id: string | null; person_id: string | null
      assumed_by: string | null; assumed_at: string | null
      ministries: { name: string } | null
      schools: { name: string } | null
      staff_applications: { id: string; status: string; form_data: Record<string, unknown> | null; token: string | null }[] | null
    }
    const sifResult = await sb
      .from('staff_interest_forms')
      .select('id, full_name, email, phone, message, status, created_at, responded_at, refusal_reason, reviewed_by, ministry_id, school_id, person_id, assumed_by, assumed_at, ministries(name), schools(name), staff_applications(id, status, form_data, token)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    for (const r of ((sifResult.data ?? []) as unknown as SIFRaw[])) {
      const ministry = r.ministries as { name: string } | null
      const school = r.schools as { name: string } | null
      const appRow = (r.staff_applications ?? []).find(a => ['enviado', 'em_analise', 'aprovado'].includes(a.status))
        ?? (r.staff_applications ?? []).find(a => a.status === 'rascunho')

      // Uma vez que a candidatura (staff_applications) já foi enviada, o card
      // 'obreiro' (montado abaixo, a partir de staff_applications) já representa
      // esse candidato — evita duplicar o mesmo nome em dois cards na lista.
      const appJaEnviada = !!appRow && ['enviado', 'em_analise', 'aprovado'].includes(appRow.status)

      if (isFinalizado(r.status) && r.refusal_reason) {
        historico.push({
          id: r.id, tipo: 'Pré-inscrição Obreiro', nome: r.full_name,
          escola: ministry?.name ?? school?.name ?? null,
          motivo: r.refusal_reason,
          recusadoPor: null,
          recusadoPorId: r.reviewed_by ?? null,
          recusadoEm: r.responded_at ?? r.created_at,
        })
      } else if (!appJaEnviada) {
        const item: InscricaoItem = {
          id: r.id, tipo: 'pre_inscricao_obreiro', tipoLabel: 'Pré-inscrição Obreiro',
          tipoColor: 'bg-orange-50 text-orange-700',
          nome: r.full_name, email: r.email, phone: r.phone ?? null,
          escola: ministry?.name ?? school?.name ?? null, schoolId: r.school_id, turma: null, classId: null,
          mensagem: r.message, status: r.status, notes: null,
          criadoEm: r.created_at, diasAberto: daysAgo(r.created_at),
          diasNaEtapaAtual: daysAgo(r.assumed_at ?? r.responded_at ?? r.created_at),
          personId: r.person_id ?? null,
          ministryId: r.ministry_id,
          staffApplicationId: appRow?.id ?? null,
          hasFormData: appRow ? (appRow.form_data !== null && Object.keys(appRow.form_data as object).length > 1) : false,
        }
        items.push(item)
        if (r.assumed_by) assumedLookups.push({ item, userId: r.assumed_by })
      }
    }

    // Candidatos a Obreiro (staff_applications sem interest_form ou com formulário preenchido)
    type StaffRaw = {
      id: string; ministry_id: string | null; school_id: string | null; interest_form_id: string | null; status: string; applied_at: string; reviewed_at: string | null; reviewed_by: string | null; refusal_reason: string | null; notes: string | null; form_data: Record<string, unknown> | null
      pastor_reference_skip_reason: string | null; hospedagem_skip_reason: string | null
      people: { id: string; full_name: string } | null
      ministries: { name: string } | null
      schools: { name: string } | null
    }
    const result = await sb
      .from('staff_applications')
      .select('id, ministry_id, school_id, interest_form_id, status, applied_at, reviewed_at, reviewed_by, refusal_reason, notes, form_data, pastor_reference_skip_reason, hospedagem_skip_reason, people(id, full_name), ministries(name), schools(name)')
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
      const school = r.schools as { name: string } | null

      // Se veio de interest_form e está em rascunho, já aparece como pré-inscrição acima
      if (r.interest_form_id && r.status === 'rascunho') continue

      if (isFinalizado(r.status) && r.refusal_reason) {
        historico.push({
          id: r.id, tipo: 'Candidato a Obreiro', nome: pessoa?.full_name ?? '—',
          escola: ministry?.name ?? school?.name ?? null,
          motivo: r.refusal_reason,
          recusadoPor: null,
          recusadoPorId: r.reviewed_by ?? null,
          recusadoEm: r.reviewed_at ?? r.applied_at,
        })
      } else {
        items.push({
          id: r.id, tipo: 'obreiro', tipoLabel: 'Candidato a Obreiro',
          tipoColor: 'bg-amber-50 text-amber-700',
          nome: pessoa?.full_name ?? '—', email: pessoa?.id ? staffEmailsByPerson.get(pessoa.id) ?? null : null, phone: null,
          escola: ministry?.name ?? school?.name ?? null, schoolId: r.school_id ?? null, turma: null, classId: null, mensagem: null,
          status: r.status, notes: r.notes ?? null,
          criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
          diasNaEtapaAtual: daysAgo(r.reviewed_at ?? r.applied_at),
          personId: pessoa?.id ?? null,
          ministryId: r.ministry_id,
          hasLogin: pessoa?.id ? staffLoginByPerson.has(pessoa.id) : false,
          staffApplicationId: r.id,
          hasFormData: r.form_data !== null && Object.keys(r.form_data as object).length > 1,
          pastorSkipped: !!r.pastor_reference_skip_reason,
          hospedagemSkipped: !!r.hospedagem_skip_reason,
          candidateArrivalDate: (r.form_data as Record<string, Record<string, string>> | null)?.s6?.data_chegada || null,
        })
      }
    }

    const obreiroAppIds = items
      .filter(i => i.tipo === 'obreiro' && i.staffApplicationId)
      .map(i => i.staffApplicationId as string)

    if (obreiroAppIds.length > 0) {
      const { data: checks } = await sb
        .from('background_checks')
        .select('id, staff_application_id, check_type, country, status, issued_at, expires_at, notes, flagged_concern')
        .in('staff_application_id', obreiroAppIds)

      type CheckRow = { id: string; staff_application_id: string; check_type: string; country: string | null; status: string; issued_at: string | null; expires_at: string | null; notes: string | null; flagged_concern: boolean }
      const summaries = new Map<string, BgCheckSummary>()
      const rowsByApp = new Map<string, CheckRow[]>()
      for (const c of (checks ?? []) as CheckRow[]) {
        const s = summaries.get(c.staff_application_id) ?? { total: 0, pendentes: 0, reprovados: 0, flagged: 0, expirados: 0 }
        s.total += 1
        if (['pendente', 'solicitado', 'em_analise'].includes(c.status)) s.pendentes += 1
        if (c.status === 'reprovado') s.reprovados += 1
        if (c.flagged_concern) s.flagged += 1
        if (c.expires_at && new Date(c.expires_at) < new Date()) s.expirados += 1
        summaries.set(c.staff_application_id, s)
        rowsByApp.set(c.staff_application_id, [...(rowsByApp.get(c.staff_application_id) ?? []), c])
      }

      for (const item of items) {
        if (item.tipo === 'obreiro' && item.staffApplicationId) {
          item.bgCheckSummary = summaries.get(item.staffApplicationId) ?? null
          item.backgroundChecks = rowsByApp.get(item.staffApplicationId) ?? []
        }
      }

      const { data: hospRequests } = await sb
        .from('service_requests')
        .select('staff_application_id, status, requested_arrival_date, requested_departure_date, created_at')
        .eq('request_type', 'hospedagem_obreiro')
        .in('staff_application_id', obreiroAppIds)
        .order('created_at', { ascending: false })

      const hospByApp = new Map<string, { status: string; arrivalDate: string | null; departureDate: string | null }>()
      for (const h of (hospRequests ?? []) as Array<{ staff_application_id: string; status: string; requested_arrival_date: string | null; requested_departure_date: string | null }>) {
        if (!hospByApp.has(h.staff_application_id)) hospByApp.set(h.staff_application_id, { status: h.status, arrivalDate: h.requested_arrival_date, departureDate: h.requested_departure_date })
      }
      for (const item of items) {
        if (item.tipo === 'obreiro' && item.staffApplicationId) {
          const hosp = hospByApp.get(item.staffApplicationId) ?? null
          item.hospedagemStatus = hosp?.status ?? null
          item.hospedagemArrivalDate = hosp?.arrivalDate ?? null
          item.hospedagemDepartureDate = hosp?.departureDate ?? null
          item.hospedagemResolved = hosp?.status === 'resolvido'
        }
      }
    }
  }

  // Hospedagem do aluno — mesmo padrão do obreiro, ligado por school_application_id.
  {
    const alunoAppIds = items
      .filter(i => i.tipo === 'pre_inscricao' && i.applicationId)
      .map(i => i.applicationId as string)

    if (alunoAppIds.length > 0) {
      const { data: hospRequestsAluno } = await sb
        .from('service_requests')
        .select('school_application_id, status, requested_arrival_date, requested_departure_date, created_at')
        .eq('request_type', 'hospedagem_aluno')
        .in('school_application_id', alunoAppIds)
        .order('created_at', { ascending: false })

      const hospByAppAluno = new Map<string, { status: string; arrivalDate: string | null; departureDate: string | null }>()
      for (const h of (hospRequestsAluno ?? []) as Array<{ school_application_id: string; status: string; requested_arrival_date: string | null; requested_departure_date: string | null }>) {
        if (!hospByAppAluno.has(h.school_application_id)) hospByAppAluno.set(h.school_application_id, { status: h.status, arrivalDate: h.requested_arrival_date, departureDate: h.requested_departure_date })
      }
      for (const item of items) {
        if (item.tipo === 'pre_inscricao' && item.applicationId) {
          const hosp = hospByAppAluno.get(item.applicationId) ?? null
          item.hospedagemStatus = hosp?.status ?? null
          item.hospedagemArrivalDate = hosp?.arrivalDate ?? null
          item.hospedagemDepartureDate = hosp?.departureDate ?? null
          item.hospedagemResolved = hosp?.status === 'resolvido'
        }
      }
    }
  }

  // Status/respostas de referências (pastor/amigo) — evita que "Links de
  // recomendação" ofereça gerar link de novo quando já foi respondido.
  {
    const staffRefIds = items
      .filter(i => (i.tipo === 'pre_inscricao_obreiro' || i.tipo === 'obreiro') && i.staffApplicationId)
      .map(i => i.staffApplicationId as string)
    const schoolRefIds = items
      .filter(i => i.tipo === 'pre_inscricao' && i.applicationId)
      .map(i => i.applicationId as string)

    type RefRow = { staff_application_id: string | null; school_application_id: string | null; type: string; status: string; form_data: Record<string, string> | null }
    const refByApp = new Map<string, RefSummary>()

    const [staffRefs, schoolRefs] = await Promise.all([
      staffRefIds.length > 0
        ? sb.from('reference_forms').select('staff_application_id, school_application_id, type, status, form_data')
          .in('staff_application_id', staffRefIds).in('type', ['pastor', 'amigo'])
        : Promise.resolve({ data: [] as RefRow[] }),
      schoolRefIds.length > 0
        ? sb.from('reference_forms').select('staff_application_id, school_application_id, type, status, form_data')
          .in('school_application_id', schoolRefIds).in('type', ['pastor', 'amigo'])
        : Promise.resolve({ data: [] as RefRow[] }),
    ])

    for (const r of [...(staffRefs.data ?? []), ...(schoolRefs.data ?? [])] as RefRow[]) {
      const appId = r.staff_application_id ?? r.school_application_id
      if (!appId || (r.type !== 'pastor' && r.type !== 'amigo')) continue
      const entry = refByApp.get(appId) ?? { pastor: null, amigo: null }
      entry[r.type as 'pastor' | 'amigo'] = { status: r.status, data: r.form_data }
      refByApp.set(appId, entry)
    }

    for (const item of items) {
      const appId = item.tipo === 'pre_inscricao' ? item.applicationId : item.staffApplicationId
      if (appId && refByApp.has(appId)) item.refSummary = refByApp.get(appId)
    }
  }

  // Lider ETED: só vê inscrições (aluno e obreiro) das suas escolas (não sem preferência)
  // Lider Ministério: só vê inscrições de obreiro do seu ministério
  const roleFiltered = isEtedLeader
    ? items.filter(i => {
        if (i.tipo === 'pre_inscricao' && !i.schoolId) return false
        if (i.tipo === 'pre_inscricao' && allowedSchoolIds && !allowedSchoolIds.includes(i.schoolId!)) return false
        if ((i.tipo === 'pre_inscricao_obreiro' || i.tipo === 'obreiro')) {
          if (!i.schoolId) return false
          if (allowedSchoolIds && !allowedSchoolIds.includes(i.schoolId)) return false
        }
        return true
      })
    : isLiderMinisterio && leaderMinistryId
    ? items.filter(i => {
        if (i.tipo === 'pre_inscricao' || i.tipo === 'aluno') return false
        if ((i.tipo === 'pre_inscricao_obreiro' || i.tipo === 'obreiro') && i.ministryId && i.ministryId !== leaderMinistryId) return false
        if (i.tipo === 'pre_inscricao_obreiro' && !i.ministryId) return false
        return true
      })
    : items

  roleFiltered.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
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

  const assumedIds = [...new Set(assumedLookups.map(a => a.userId))]
  const assumedNames = new Map<string, string>()
  await Promise.all(assumedIds.map(async (id) => {
    const { data } = await sb.auth.admin.getUserById(id)
    const displayName = getUserDisplayName(data.user)
    if (displayName) assumedNames.set(id, displayName)
  }))
  for (const { item, userId } of assumedLookups) {
    item.assumedByName = assumedNames.get(userId) ?? null
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
            {(canWrite || canWriteEted) && (
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
            )}
            {canWriteObreiro && (
              <NovaPreInscricaoObreiroButton
                slug={slug}
                criarAction={criarPreInscricaoObreiroManual}
                ministries={allMinistries}
                schools={allSchools}
              />
            )}
          </div>
        }
      />

      <Suspense><ScrollHighlight /></Suspense>
      <main className="p-4 md:p-6 space-y-4">

        <Suspense>
        <InscricoesList
          items={roleFiltered}
          historico={historicoTab}
          slug={slug}
          orgId={orgId}
          initialTab={tab}
          initialEtapa={etapa}
          hideAlunoTipo={isLiderMinisterio}
          linksAluno={publicSchools.length > 0 ? (
            <InscricaoLinkCard
              orgSlug={slug}
              schools={(allowedSchoolIds
                ? publicSchools.filter(s => allowedSchoolIds.includes(s.id))
                : publicSchools
              ).map(s => ({ slug: s.slug, name: s.name }))}
            />
          ) : null}
          linksObreiro={(
            <>
              <ServirLinkCard slug={slug} />
              {publicMinistries.length > 0 && (
                <MinistryLinkCard
                  orgSlug={slug}
                  ministries={(isLiderMinisterio && leaderMinistryId
                    ? publicMinistries.filter(m => m.id === leaderMinistryId)
                    : publicMinistries
                  ).map(m => ({ slug: m.slug, name: m.name }))}
                />
              )}
            </>
          )}
          openClasses={openClasses.map(c => ({
            id: c.id,
            school_id: c.school_id,
            name: c.name,
            starts_at: c.starts_at,
            schoolName: c.schools?.name ?? null,
          }))}
          allSchools={allSchools}
          allMinistries={allMinistries}
          canWrite={canWrite}
          canWriteEted={canWriteEted}
          canWriteObreiro={canWriteObreiro}
          allowedSchoolIds={allowedSchoolIds}
          quota={quota}
          initialQuery={q ?? ''}
          updateStatus={updateStatus}
          recusar={recusar}
          aprovar={aprovar}
          salvarPalavraLider={salvarPalavraLider}
          assumirPreInscricaoObreiro={assumirPreInscricaoObreiro}
          finalizarObreiro={finalizarObreiro}
          disponibilizarFormulario={disponibilizarFormulario}
          disponibilizarFormularioObreiro={disponibilizarFormularioObreiro}
          editarPreInscricao={editarPreInscricao}
          editarPreInscricaoObreiro={editarPreInscricaoObreiro}
          marcarRecebidoExternamente={marcarRecebidoExternamente}
          marcarRecebidoExternamenteObreiro={marcarRecebidoExternamenteObreiro}
          encaminharParaEscola={encaminharParaEscola}
          encaminharParaMinisterio={encaminharParaMinisterio}
        />
        </Suspense>

      </main>
    </>
  )
}
