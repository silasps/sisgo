import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'
import { getRolePreview } from '@/lib/role-preview'
import { SearchBar } from '@/components/ui/SearchBar'
import { Suspense } from 'react'
import { SCHOOL_APPLICATION_TYPES } from '@/lib/schools'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string; q?: string }>
}

const TABS = [
  { key: 'todos',       label: 'Todos' },
  { key: 'inscricoes',  label: 'Inscrições' },
  { key: 'obreiros',    label: 'Obreiros' },
  { key: 'alunos',      label: 'Alunos' },
  { key: 'voluntarios', label: 'Voluntários' },
  { key: 'associados',  label: 'Associados' },
  { key: 'visitantes',  label: 'Visitantes' },
]

const OBREIRO_STATUS_COLORS: Record<string, string> = {
  true:  'bg-green-50 text-green-700',
  false: 'bg-gray-100 text-gray-500',
}

const INTEREST_STATUS: Record<string, { label: string; color: string }> = {
  pendente:           { label: 'Pendente',      color: 'bg-yellow-100 text-yellow-700' },
  formulario_enviado: { label: 'Form. enviado',  color: 'bg-blue-100 text-blue-700' },
  em_contato:         { label: 'Em contato',    color: 'bg-purple-100 text-purple-700' },
  em_analise:         { label: 'Em análise',    color: 'bg-blue-100 text-blue-700' },
}

const STUDENT_STAGE_COLORS: Record<string, string> = {
  aguardando: 'bg-amber-50 text-amber-700',
  estudando: 'bg-green-50 text-green-700',
  encerrada: 'bg-slate-100 text-slate-600',
  concluido: 'bg-blue-50 text-blue-700',
  trancado: 'bg-orange-50 text-orange-700',
  reprovado: 'bg-red-50 text-red-700',
  inativo: 'bg-gray-100 text-gray-500',
  sem_turma: 'bg-gray-100 text-gray-600',
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function getUserDisplayName(user: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined) {
  const metadata = user?.user_metadata ?? {}
  const name = metadata.full_name ?? metadata.name ?? metadata.fullName ?? metadata.display_name
  return typeof name === 'string' && name.trim() ? name : user?.email ?? null
}

function getStudentStage(enrollment: StudentEnrollment | undefined, active: boolean) {
  if (!active) return { label: 'Inativo', color: STUDENT_STAGE_COLORS.inativo }
  if (!enrollment) return { label: 'Sem turma definida', color: STUDENT_STAGE_COLORS.sem_turma }

  if (enrollment.status === 'trancado') return { label: 'Trancado', color: STUDENT_STAGE_COLORS.trancado }
  if (enrollment.status === 'concluido') return { label: 'Concluiu', color: STUDENT_STAGE_COLORS.concluido }
  if (enrollment.status === 'reprovado') return { label: 'Reprovado', color: STUDENT_STAGE_COLORS.reprovado }

  const now = new Date()
  const startsAt = enrollment.school_classes?.starts_at ? new Date(enrollment.school_classes.starts_at) : null
  const endsAt = enrollment.school_classes?.ends_at ? new Date(enrollment.school_classes.ends_at) : null

  if (startsAt && startsAt > now) return { label: 'Aguardando início', color: STUDENT_STAGE_COLORS.aguardando }
  if (endsAt && endsAt < now) return { label: 'Turma encerrada', color: STUDENT_STAGE_COLORS.encerrada }
  return { label: 'Estudando', color: STUDENT_STAGE_COLORS.estudando }
}

function urgencyBadge(dias: number) {
  if (dias <= 1) return { label: dias === 0 ? 'Hoje' : '1d', color: 'bg-green-100 text-green-700' }
  if (dias === 2) return { label: '2d', color: 'bg-yellow-100 text-yellow-700' }
  if (dias === 3) return { label: '3d', color: 'bg-orange-100 text-orange-700' }
  return { label: `${dias}d`, color: 'bg-red-100 text-red-700' }
}

type StudentEnrollment = {
  id: string
  person_id: string
  class_id: string
  status: string
  enrolled_at: string
  school_classes: {
    name: string
    starts_at: string | null
    ends_at: string | null
    schools: { name: string } | null
  } | null
}

export default async function PessoasPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { tab = 'todos', q } = await searchParams
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  const orgId = org?.id ?? ''

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

  const sbAdmin = createAdminClient()
  let openClassesQuery = sbAdmin
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

  const openClasses = (openClassesRaw ?? []) as unknown as Array<{
    id: string
    school_id: string
    name: string
    starts_at: string | null
    schools: { name: string } | null
  }>

  async function trocarTurmaAluno(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { createClient } = await import('@/lib/supabase/server')
    const { redirect } = await import('next/navigation')
    const db = adm()
    const authClient = await createClient()
    const personId = formData.get('person_id') as string
    const classId = formData.get('class_id') as string
    const orgIdForm = formData.get('org_id') as string

    if (!personId || !classId || !orgIdForm) return

    const { data: { user } } = await authClient.auth.getUser()
    const { data: orgUsers } = await authClient
      .from('organization_users')
      .select('organization_id, roles(name)')
      .eq('user_id', user?.id ?? '')
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
      .select('id, school_id, schools!inner(organization_id, school_type)')
      .eq('id', classId)
      .eq('active', true)
      .eq('registrations_open', true)
      .eq('schools.organization_id', orgIdForm)
      .in('schools.school_type', [...SCHOOL_APPLICATION_TYPES])
      .single()

    if (!classRow) return

    if (role === 'lider_eted') {
      const { data: leaderLink } = await db
        .from('school_leaders')
        .select('id')
        .eq('organization_id', orgIdForm)
        .eq('user_id', user?.id ?? '')
        .eq('school_id', classRow.school_id)
        .maybeSingle()
      if (!leaderLink) return
    }

    const { data: currentEnrollments } = await db
      .from('class_students')
      .select('id, school_classes!inner(schools!inner(organization_id))')
      .eq('person_id', personId)
      .eq('school_classes.schools.organization_id', orgIdForm)
      .eq('status', 'ativo')

    const enrollmentIds = (currentEnrollments ?? []).map(row => row.id)
    if (enrollmentIds.length > 0) {
      await db.from('class_students').delete().in('id', enrollmentIds)
    }

    await db.from('class_students').upsert({
      class_id: classId,
      person_id: personId,
      status: 'ativo',
    }, { onConflict: 'class_id,person_id' })

    redirect(`/${slug}/pessoas?tab=alunos`)
  }

  // ── Dados por aba ──────────────────────────────────────────────────────

  type InscritoItem = {
    id: string
    tipo: string
    tipoColor: string
    nome: string
    email: string | null
    escola: string | null
    status: string
    criadoEm: string
    diasAberto: number
  }

  const inscritoItems: InscritoItem[] = []

  if (tab === 'inscricoes') {
    const sbAdmin = createAdminClient()

    // Pré-inscrições públicas
    type IFRaw = { id: string; full_name: string; email: string; status: string; created_at: string; schools: { name: string } | null }
    const { data: iforms } = await sbAdmin
      .from('school_interest_forms')
      .select('id, full_name, email, status, created_at, schools(name)')
      .eq('organization_id', orgId)
      .not('status', 'in', '("convertido","descartado")')
      .order('created_at', { ascending: false })
    for (const r of ((iforms ?? []) as unknown as IFRaw[])) {
      inscritoItems.push({
        id: r.id, tipo: 'Pré-inscrição', tipoColor: 'bg-indigo-50 text-indigo-700',
        nome: r.full_name, email: r.email,
        escola: (r.schools as { name: string } | null)?.name ?? null,
        status: r.status, criadoEm: r.created_at, diasAberto: daysAgo(r.created_at),
      })
    }

    // Candidatos a Aluno
    type SAraw = { id: string; status: string; applied_at: string; people: { full_name: string } | null; schools: { name: string } | null }
    const { data: sapps } = await sbAdmin
      .from('student_applications')
      .select('id, status, applied_at, people(full_name), schools(name)')
      .eq('organization_id', orgId)
      .not('status', 'in', '("aprovado","reprovado","cancelado")')
      .order('applied_at', { ascending: false })
    for (const r of ((sapps ?? []) as unknown as SAraw[])) {
      inscritoItems.push({
        id: r.id, tipo: 'Candidato a Aluno', tipoColor: 'bg-sky-50 text-sky-700',
        nome: r.people?.full_name ?? '—', email: null,
        escola: (r.schools as { name: string } | null)?.name ?? null,
        status: r.status, criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
      })
    }

    // Candidatos a Obreiro
    type StaffRaw = { id: string; status: string; applied_at: string; people: { full_name: string } | null }
    const { data: staffapps } = await sbAdmin
      .from('staff_applications')
      .select('id, status, applied_at, people(full_name)')
      .eq('organization_id', orgId)
      .not('status', 'in', '("aprovado","reprovado","cancelado")')
      .order('applied_at', { ascending: false })
    for (const r of ((staffapps ?? []) as unknown as StaffRaw[])) {
      inscritoItems.push({
        id: r.id, tipo: 'Candidato a Obreiro', tipoColor: 'bg-amber-50 text-amber-700',
        nome: r.people?.full_name ?? '—', email: null, escola: null,
        status: r.status, criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
      })
    }

    inscritoItems.sort((a, b) => b.diasAberto - a.diasAberto)
  }

  type Row = {
    id: string
    personId?: string
    classId?: string | null
    nome: string
    detalhe: string | null
    meta?: string | null
    col2: string
    col2Label: string
    badge: { label: string; color: string } | null
  }

  let rows: Row[] = []

  if (tab === 'todos') {
    // Exclui pré-inscritos ainda não convertidos (ficam na aba Inscritos)
    const query = supabase
      .from('people')
      .select('id, full_name, preferred_name, gender, source')
      .eq('organization_id', orgId)
      .order('full_name')

    const { data, error } = await query

    if (!error) {
      rows = ((data ?? []) as unknown as { id: string; full_name: string; preferred_name: string | null; gender: string | null; source: string | null }[])
        .filter(p => p.source !== 'pre_inscricao_publica')
        .map(p => ({
          id: p.id,
          nome: p.full_name,
          detalhe: p.preferred_name ?? null,
          col2: p.gender ?? '—',
          col2Label: 'Gênero',
          badge: null,
        }))
    } else {
      // Fallback se a coluna source ainda não existir (migration pendente)
      const { data: fallbackData } = await supabase
        .from('people')
        .select('id, full_name, preferred_name, gender')
        .eq('organization_id', orgId)
        .order('full_name')

      rows = (fallbackData ?? []).map(p => ({
        id: p.id,
        nome: p.full_name,
        detalhe: p.preferred_name ?? null,
        col2: p.gender ?? '—',
        col2Label: 'Gênero',
        badge: null,
      }))
    }
  }

  if (tab === 'obreiros') {
    type ObreiroRaw = { id: string; role_title: string | null; area: string | null; active: boolean; user_id?: string | null; people: { full_name: string } | null }
    const result = await supabase
      .from('staff_profiles')
      .select('id, role_title, area, active, user_id, people(full_name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    let staffProfiles = (result.data ?? []) as unknown as ObreiroRaw[]
    if (result.error) {
      const fallback = await supabase
        .from('staff_profiles')
        .select('id, role_title, area, active, people(full_name)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
      staffProfiles = (fallback.data ?? []) as unknown as ObreiroRaw[]
    }

    rows = staffProfiles.map(s => ({
      id: s.id,
      nome: s.people?.full_name ?? '—',
      detalhe: s.area ?? null,
      meta: s.user_id ? null : 'Obreiro sem cadastro',
      col2: s.role_title ?? '—',
      col2Label: 'Função',
      badge: { label: s.active ? 'Ativo' : 'Inativo', color: OBREIRO_STATUS_COLORS[String(s.active)] },
    }))
  }

  if (tab === 'alunos') {
    type AlunoRaw = { id: string; active: boolean; accepted_by?: string | null; people: { id: string; full_name: string } | null }
    const result = await supabase
      .from('student_profiles')
      .select('id, active, accepted_by, people(id, full_name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    let studentProfiles = (result.data ?? []) as unknown as AlunoRaw[]

    if (result.error) {
      const fallback = await supabase
        .from('student_profiles')
        .select('id, active, people(id, full_name)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
      studentProfiles = (fallback.data ?? []) as unknown as AlunoRaw[]
    }

    const personIds = studentProfiles
      .map(student => student.people?.id)
      .filter((id): id is string => Boolean(id))

    const acceptedByByPerson = new Map<string, string>()

    for (const student of studentProfiles) {
      const personId = student.people?.id
      if (personId && student.accepted_by) acceptedByByPerson.set(personId, student.accepted_by)
    }

    if (personIds.length > 0) {
      const { data: acceptedApps } = await sbAdmin
        .from('student_applications')
        .select('person_id, reviewed_by, reviewed_at')
        .eq('organization_id', orgId)
        .eq('status', 'aprovado')
        .in('person_id', personIds)
        .not('reviewed_by', 'is', null)
        .order('reviewed_at', { ascending: false })

      for (const app of (acceptedApps ?? []) as Array<{ person_id: string; reviewed_by: string | null }>) {
        if (app.reviewed_by && !acceptedByByPerson.has(app.person_id)) {
          acceptedByByPerson.set(app.person_id, app.reviewed_by)
        }
      }

      const convertedFormsResult = await sbAdmin
        .from('school_interest_forms')
        .select('person_id, reviewed_by, reviewed_at, responded_at')
        .eq('organization_id', orgId)
        .eq('status', 'convertido')
        .in('person_id', personIds)
        .not('reviewed_by', 'is', null)
        .order('reviewed_at', { ascending: false })

      if (!convertedFormsResult.error) {
        for (const form of (convertedFormsResult.data ?? []) as Array<{ person_id: string | null; reviewed_by: string | null }>) {
          if (form.person_id && form.reviewed_by && !acceptedByByPerson.has(form.person_id)) {
            acceptedByByPerson.set(form.person_id, form.reviewed_by)
          }
        }
      }
    }

    const accepterIds = [...new Set([...acceptedByByPerson.values()])]
    const accepterNames = new Map<string, string>()

    if (accepterIds.length > 0) {
      const { data: usersData } = await sbAdmin.auth.admin.listUsers({ perPage: 1000 })
      for (const authUser of usersData.users) {
        if (!accepterIds.includes(authUser.id)) continue
        const displayName = getUserDisplayName(authUser)
        if (displayName) accepterNames.set(authUser.id, displayName)
      }

      await Promise.all(accepterIds
        .filter(id => !accepterNames.has(id))
        .map(async (id) => {
          const { data } = await sbAdmin.auth.admin.getUserById(id)
          const displayName = getUserDisplayName(data.user)
          if (displayName) accepterNames.set(id, displayName)
        }))
    }

    let enrollmentsByPerson = new Map<string, StudentEnrollment>()

    if (personIds.length > 0) {
      const { data: enrollments } = await supabase
        .from('class_students')
        .select('id, person_id, class_id, status, enrolled_at, school_classes(name, starts_at, ends_at, schools(name))')
        .in('person_id', personIds)
        .order('enrolled_at', { ascending: false })

      enrollmentsByPerson = ((enrollments ?? []) as unknown as StudentEnrollment[])
        .reduce((map, enrollment) => {
          const current = map.get(enrollment.person_id)
          const currentStart = current?.school_classes?.starts_at ?? ''
          const nextStart = enrollment.school_classes?.starts_at ?? ''
          if (!current || nextStart > currentStart) map.set(enrollment.person_id, enrollment)
          return map
        }, new Map<string, StudentEnrollment>())
    }

    rows = studentProfiles.map(s => {
      const personId = s.people?.id ?? ''
      const enrollment = enrollmentsByPerson.get(personId)
      const stage = getStudentStage(enrollment, s.active)
      const className = enrollment?.school_classes?.name ?? 'Sem turma definida'
      const schoolName = enrollment?.school_classes?.schools?.name
      const startsAt = formatDate(enrollment?.school_classes?.starts_at ?? null)
      const endsAt = formatDate(enrollment?.school_classes?.ends_at ?? null)
      const period = startsAt && endsAt ? `${startsAt} até ${endsAt}` : startsAt ? `Início: ${startsAt}` : null
      const acceptedBy = acceptedByByPerson.get(personId)

      return {
        id: s.id,
        personId,
        classId: enrollment?.class_id ?? null,
        nome: s.people?.full_name ?? '—',
        detalhe: [schoolName, period].filter(Boolean).join(' · ') || null,
        meta: acceptedBy ? `Aceito por ${accepterNames.get(acceptedBy) ?? 'usuário não encontrado'}` : 'Aceito por: não registrado',
        col2: className,
        col2Label: 'Turma',
        badge: stage,
      }
    })
  }

  if (tab === 'voluntarios' || tab === 'associados') {
    type StatusRaw = { id: string; person_id: string; status: string; started_at: string; people: { id: string; full_name: string } | null }
    const { data } = await supabase
      .from('person_status_history')
      .select('id, person_id, status, started_at, people(id, full_name)')
      .eq('status', tab === 'voluntarios' ? 'voluntario' : 'associado')
      .is('ended_at', null)
      .order('started_at', { ascending: false })
    rows = ((data ?? []) as unknown as StatusRaw[])
      .filter(r => r.people != null)
      .map(r => ({
        id: r.id,
        nome: r.people?.full_name ?? '—',
        detalhe: null,
        col2: new Date(r.started_at).toLocaleDateString('pt-BR'),
        col2Label: 'Desde',
        badge: { label: tab === 'voluntarios' ? 'Voluntário' : 'Associado', color: 'bg-indigo-50 text-indigo-700' },
      }))
  }

  if (tab === 'visitantes') {
    type StatusRaw = { id: string; person_id: string; status: string; started_at: string; ended_at: string | null; people: { id: string; full_name: string } | null }
    const { data } = await supabase
      .from('person_status_history')
      .select('id, person_id, status, started_at, ended_at, people(id, full_name)')
      .eq('status', 'visitante')
      .order('started_at', { ascending: false })
      .limit(100)
    rows = ((data ?? []) as unknown as StatusRaw[])
      .filter(r => r.people != null)
      .map(r => ({
        id: r.id,
        nome: r.people?.full_name ?? '—',
        detalhe: null,
        col2: new Date(r.started_at).toLocaleDateString('pt-BR'),
        col2Label: 'Visita em',
        badge: r.ended_at
          ? { label: 'Encerrada', color: 'bg-gray-100 text-gray-500' }
          : { label: 'Ativo', color: 'bg-green-50 text-green-700' },
      }))
  }

  const filteredRows = q
    ? rows.filter(r => r.nome.toLowerCase().includes(q.toLowerCase()))
    : rows
  const col2Label = rows[0]?.col2Label ?? 'Detalhe'
  const badgeLabel = tab === 'alunos' ? 'Etapa' : 'Status'

  return (
    <>
      <Header
        title="Pessoas"
        actions={
          <button className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600">
            + Nova pessoa
          </button>
        }
      />
      <main className="p-4 md:p-6 space-y-4">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <Link
              key={t.key}
              href={`/${slug}/pessoas?tab=${t.key}`}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* ── Aba Inscrições ────────────────────────────────────────────────── */}
        {tab === 'inscricoes' && (
          <>
            {!inscritoItems.length ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-gray-400 text-sm">Nenhuma inscrição pendente.</p>
                <Link href={`/${slug}/inscricoes`} className="text-xs text-brand-500 hover:underline mt-2 inline-block">
                  Ver todas as inscrições →
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-400">{inscritoItems.length} inscrição{inscritoItems.length !== 1 ? 'ões' : ''} ativa{inscritoItems.length !== 1 ? 's' : ''}</p>
                  <Link href={`/${slug}/inscricoes`} className="text-xs text-brand-500 hover:text-brand-700 font-medium">
                    Gerenciar todas →
                  </Link>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 w-14">Dias</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                      <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                      <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Escola</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inscritoItems.map(item => {
                      const urgency = urgencyBadge(item.diasAberto)
                      const statusInfo = INTEREST_STATUS[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-500' }
                      const tabDestino = item.tipo === 'Pré-inscrição' ? 'pre_inscricao' : item.tipo === 'Candidato a Aluno' ? 'aluno' : 'obreiro'
                      return (
                        <tr key={`${item.tipo}-${item.id}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${urgency.color}`}>
                              {urgency.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{item.nome}</p>
                            {item.email && <p className="text-xs text-gray-400">{item.email}</p>}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.tipoColor}`}>
                              {item.tipo}
                            </span>
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-xs text-gray-500">
                            {item.escola ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/${slug}/inscricoes?tab=${tabDestino}`}
                              className="text-xs text-brand-500 hover:text-brand-700 font-medium"
                            >
                              Gerenciar →
                            </Link>
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

        {/* ── Abas padrão ───────────────────────────────────────────────────── */}
        {tab !== 'inscricoes' && (
          <>
            <Suspense>
              <SearchBar placeholder="Buscar por nome…" className="w-full sm:w-72" />
            </Suspense>
            {!filteredRows.length ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-gray-400 text-sm">
                  {q ? `Nenhum resultado para "${q}".` : 'Nenhum registro encontrado nesta categoria.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                      <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">{col2Label}</th>
                      <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">{badgeLabel}</th>
                      {tab === 'alunos' && <th className="hidden md:table-cell px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{r.nome}</p>
                          {r.detalhe && <p className="text-xs text-gray-400">{r.detalhe}</p>}
                          {r.meta && <p className="text-xs text-gray-500 mt-0.5">{r.meta}</p>}
                          <div className="md:hidden flex items-center gap-2 mt-1 flex-wrap">
                            {r.col2 && r.col2 !== '—' && (
                              <span className="text-xs text-gray-500">{r.col2}</span>
                            )}
                            {r.badge && (
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.badge.color}`}>
                                {r.badge.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-gray-500">
                          {tab === 'alunos' && r.personId ? (
                            <form action={trocarTurmaAluno} className="flex max-w-md items-center gap-2">
                              <input type="hidden" name="person_id" value={r.personId} />
                              <input type="hidden" name="org_id" value={orgId} />
                              <select
                                name="class_id"
                                defaultValue={r.classId ?? ''}
                                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
                              >
                                <option value="" disabled>Sem turma definida</option>
                                {r.classId && !openClasses.some(classOption => classOption.id === r.classId) && (
                                  <option value={r.classId}>{r.col2} · atual</option>
                                )}
                                {openClasses.map(classOption => (
                                  <option key={classOption.id} value={classOption.id}>
                                    {classOption.schools?.name ?? 'Escola'} · {classOption.name}
                                    {classOption.starts_at ? ` · ${new Date(classOption.starts_at).toLocaleDateString('pt-BR')}` : ''}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                className="rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                              >
                                Confirmar
                              </button>
                            </form>
                          ) : (
                            r.col2
                          )}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3">
                          {r.badge ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.badge.color}`}>
                              {r.badge.label}
                            </span>
                          ) : '—'}
                        </td>
                        {tab === 'alunos' && r.personId && (
                          <td className="hidden md:table-cell px-4 py-3 text-right">
                            <Link
                              href={`/${slug}/pessoas/${r.personId}/saude`}
                              className="text-xs text-brand-500 hover:text-brand-700 font-medium hover:underline transition-colors"
                            >
                              Ver saúde →
                            </Link>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
