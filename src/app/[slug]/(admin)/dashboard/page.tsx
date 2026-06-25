import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { AnimatedDonutChart } from '@/components/ui/AnimatedDonutChart'
import { FinancialMiniChart } from '@/components/ui/FinancialMiniChart'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import Link from 'next/link'
import { getRolePreview } from '@/lib/role-preview'
import { isManagementRole } from '@/lib/auth/permissions'
import type { LucideIcon } from 'lucide-react'
import {
  Users, Briefcase, GraduationCap, BookOpen, Music, Home,
  CalendarDays, AlertTriangle, ClipboardList, CheckCircle2,
  User, Wallet, LayoutDashboard, MessageSquare, Wrench, UtensilsCrossed, BedDouble,
} from 'lucide-react'

type Props = { params: Promise<{ slug: string }> }

const PERSON_STATUSES = [
  { key: 'visitante',   label: 'Visitante',   color: '#67E8F9' },
  { key: 'candidato',   label: 'Candidato',   color: '#60A5FA' },
  { key: 'aluno',       label: 'Aluno',       color: '#A78BFA' },
  { key: 'obreiro',     label: 'Obreiro',     color: '#34D399' },
  { key: 'voluntario',  label: 'Voluntário',  color: '#F47920' },
  { key: 'associado',   label: 'Associado',   color: '#F472B6' },
  { key: 'inativo',     label: 'Inativo',     color: '#D1D5DB' },
  { key: 'sem_status',  label: 'Sem status',  color: '#9CA3AF' },
] as const

export default async function BaseDashboard({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, department_assignments')
    .eq('slug', slug)
    .single()

  const orgId = org?.id ?? ''
  const deptAssignments = (org?.department_assignments as Record<string, string> | null)
    ?? { hospitalidade: 'hospitalidade', secretaria: 'secretaria' }
  const today = new Date().toISOString()

  // ── Discover current user role ──────────────────────────────
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
  const myDepts = Object.entries(deptAssignments)
    .filter(([, assignedRole]) => assignedRole === userRole)
    .map(([dept]) => dept)
  const isManagement = isManagementRole(userRole)
  const isHospitalidade = userRole === 'hospitalidade' || myDepts.includes('hospitalidade')
  const isSecretaria = userRole === 'secretaria'
  const isCozinha = userRole === 'cozinha'
  const isLiderMinisterio = userRole === 'lider_ministerio'
  const isObreiroMinisterio = userRole === 'obreiro_ministerio'
  const isAluno = userRole === 'aluno'
  const isAssociado = userRole === 'associado'
  const isPersonalRole = isAluno || isAssociado
  const isEtedLeader = userRole === 'lider_eted' || userRole === 'obreiro_eted' || isAluno

  if (isPersonalRole) {
    const { count: myReservations } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('requested_by', user?.id ?? '')

    return (
      <>
        <Header title="Dashboard" />
        <main className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-stagger">
            <StatCard label="Reservas" value={myReservations ?? 0} icon={Home} href={`/${slug}/reservas`} color="orange" />
          </div>

          <SectionCard title="Minha visão" href={`/${slug}/reservas`} linkLabel="Ver reservas">
            <EmptyState icon={User} label="Acesso restrito às suas próprias solicitações" />
          </SectionCard>
        </main>
      </>
    )
  }

  // For lider_eted: discover their assigned school IDs
  let etedSchoolIds: string[] = []
  let etedSchoolNames: string[] = []

  if (isEtedLeader) {
    const mySchools = preview?.schoolId
      ? [{ school_id: preview.schoolId, schools: null }]
      : (await supabase
        .from('school_leaders')
        .select('school_id, schools(name)')
        .eq('user_id', user?.id ?? '')
        .eq('organization_id', orgId)).data

    etedSchoolIds = mySchools?.map(s => s.school_id) ?? []
    etedSchoolNames = mySchools?.map(s => (s.schools as unknown as { name: string })?.name).filter(Boolean) ?? []
  }

  if (isHospitalidade) {
    const hospitalityDepts = myDepts.length > 0 ? myDepts : ['hospitalidade']
    const [{ count: pendingRooms }, { count: approvedRooms }, { count: serviceRequests }, { data: latestRooms }] = await Promise.all([
      supabase.from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('type', 'quarto')
        .eq('status', 'pendente'),
      supabase.from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('type', 'quarto')
        .eq('status', 'aprovada')
        .gte('starts_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
      supabase.from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('target_department', hospitalityDepts)
        .in('status', ['pendente', 'em_analise']),
      supabase.from('reservations')
        .select('id, title, starts_at, ends_at, guests_count, status')
        .eq('organization_id', orgId)
        .eq('type', 'quarto')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    return (
      <>
        <Header title="Dashboard" />
        <main className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-stagger">
            <StatCard label="Quartos pendentes" value={pendingRooms ?? 0} icon={Home} href={`/${slug}/reservas`} color="orange" />
            <StatCard label="Hospedagens do mês" value={approvedRooms ?? 0} icon={CalendarDays} href={`/${slug}/reservas?tab=quartos`} color="green" />
            <StatCard label="Solicitações" value={serviceRequests ?? 0} icon={AlertTriangle} href={`/${slug}/pendentes`} color="pink" />
          </div>

          <SectionCard title="Reservas de quarto recentes" href={`/${slug}/reservas`} linkLabel="Ver reservas">
            {!latestRooms || latestRooms.length === 0 ? (
              <EmptyState icon={Home} label="Nenhuma reserva de quarto encontrada" />
            ) : (
              <div className="divide-y divide-gray-100">
                {latestRooms.map(room => (
                  <div key={room.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{room.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {fmt(room.starts_at)} → {fmt(room.ends_at)}
                        {room.guests_count ? ` · ${room.guests_count} pessoa${room.guests_count > 1 ? 's' : ''}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{room.status}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </main>
      </>
    )
  }

  if (isLiderMinisterio || isObreiroMinisterio) {
    const sbAdmin = createAdminClient()
    const ministryId = preview?.ministryId
      ?? (isLiderMinisterio
        ? (await supabase.from('ministry_leaders').select('ministry_id').eq('user_id', user?.id ?? '').single()).data?.ministry_id
        : null)

    const obreiroMinistryId = isObreiroMinisterio && !ministryId
      ? await (async () => {
          const { data: sp } = await sbAdmin.from('staff_profiles').select('person_id').eq('organization_id', orgId).eq('user_id', user?.id ?? '').single()
          if (!sp?.person_id) return null
          const { data: mm } = await sbAdmin.from('ministry_members').select('ministry_id').eq('person_id', sp.person_id).eq('active', true).limit(1).single()
          return mm?.ministry_id ?? null
        })()
      : null

    const resolvedMinistryId = ministryId ?? obreiroMinistryId

    const [{ count: pendingRequests }, { count: myReservations }, { data: ministry }, { count: memberCount }, { count: upcomingEvents }] = await Promise.all([
      resolvedMinistryId
        ? supabase.from('ministry_pending_requests')
          .select('*', { count: 'exact', head: true })
          .eq('ministry_id', resolvedMinistryId)
          .eq('status', 'pendente')
        : supabase.from('service_requests')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('requester_id', user?.id ?? '')
          .in('status', ['pendente', 'em_analise']),
      supabase.from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('requested_by', user?.id ?? ''),
      resolvedMinistryId
        ? supabase.from('ministries').select('id, name').eq('id', resolvedMinistryId).single()
        : Promise.resolve({ data: null }),
      resolvedMinistryId
        ? supabase.from('ministry_members').select('*', { count: 'exact', head: true }).eq('ministry_id', resolvedMinistryId).eq('active', true)
        : Promise.resolve({ count: 0 }),
      resolvedMinistryId
        ? sbAdmin.from('ministry_calendar_events').select('*', { count: 'exact', head: true }).eq('ministry_id', resolvedMinistryId).gte('starts_at', new Date().toISOString())
        : Promise.resolve({ count: 0 }),
    ])

    const ministryBase = resolvedMinistryId ? `/${slug}/ministerios/${resolvedMinistryId}` : `/${slug}/ministerios`

    return (
      <>
        <Header title="Dashboard" />
        <main className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">
          {ministry?.name && (
            <p className="text-sm text-gray-500">Ministério: <span className="font-semibold text-gray-900">{ministry.name}</span></p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-stagger">
            <StatCard label="Membros" value={memberCount ?? 0} icon={Users} href={`${ministryBase}/equipe`} color="teal" />
            <StatCard label={isLiderMinisterio ? 'Pendências' : 'Solicitações'} value={pendingRequests ?? 0} icon={AlertTriangle} href={`${ministryBase}/equipe`} color="pink" />
            <StatCard label="Eventos futuros" value={upcomingEvents ?? 0} icon={CalendarDays} href={`${ministryBase}/calendario`} color="blue" />
            <StatCard label="Reservas" value={myReservations ?? 0} icon={Home} href={`/${slug}/reservas`} color="orange" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link href={ministryBase} className="group bg-white rounded-xl border border-gray-200 p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">Geral</p>
              <p className="text-xs text-gray-500 mt-0.5">Visão geral do ministério</p>
            </Link>
            <Link href={`${ministryBase}/equipe`} className="group bg-white rounded-xl border border-gray-200 p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">Equipe</p>
              <p className="text-xs text-gray-500 mt-0.5">Membros e solicitações</p>
            </Link>
            <Link href={`${ministryBase}/calendario`} className="group bg-white rounded-xl border border-gray-200 p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">Calendário</p>
              <p className="text-xs text-gray-500 mt-0.5">Reuniões e devocionais</p>
            </Link>
          </div>
        </main>
      </>
    )
  }

  if (isSecretaria || isCozinha) {
    const scopedDepartments = myDepts.length > 0
      ? myDepts
      : isSecretaria
        ? ['secretaria']
        : ['no-match']

    const { count: serviceRequests } = await supabase.from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('target_department', scopedDepartments)
        .in('status', ['pendente', 'em_analise'])

    return (
      <>
        <Header title="Dashboard" />
        <main className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-stagger">
            <StatCard label="Solicitações da área" value={serviceRequests ?? 0} icon={AlertTriangle} href={`/${slug}/pendentes`} color="pink" />
          </div>

          <SectionCard
            title={isSecretaria ? 'Secretaria' : 'Cozinha'}
            href={isCozinha ? `/${slug}/cozinha` : undefined}
            linkLabel={isCozinha ? 'Abrir cozinha' : undefined}
          >
            <EmptyState
              icon={LayoutDashboard}
              label={scopedDepartments[0] === 'no-match'
                ? 'Nenhum departamento foi vinculado a este papel ainda'
                : `Escopo: ${scopedDepartments.join(', ')}`}
            />
          </SectionCard>
        </main>
      </>
    )
  }

  if (userRole === 'dh') {
    const sbDH = createAdminClient()
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()

    const [
      { count: pendingStudentInterests },
      { count: pendingStaffInterests },
      { count: formsAwaiting },
      { count: staffFormsAwaiting },
      { count: refsAwaiting },
      { count: staffToFinalize },
      { count: urgentNoResponse },
      { count: upcomingVisitors },
    ] = await Promise.all([
      sbDH.from('school_interest_forms')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .not('status', 'in', '("convertido","descartado")'),
      sbDH.from('staff_interest_forms')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .not('status', 'in', '("convertido","descartado")'),
      sbDH.from('school_interest_forms')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'formulario_enviado'),
      sbDH.from('staff_interest_forms')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'formulario_enviado'),
      sbDH.from('reference_forms')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'pendente'),
      sbDH.from('staff_applications')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'em_analise'),
      sbDH.from('school_interest_forms')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'pendente')
        .lt('created_at', threeDaysAgo),
      sbDH.from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'aprovada')
        .gte('starts_at', today),
    ])

    const totalPipeline = (pendingStudentInterests ?? 0) + (pendingStaffInterests ?? 0)
    const totalForms = (formsAwaiting ?? 0) + (staffFormsAwaiting ?? 0)

    return (
      <>
        <Header title="Dashboard" />
        <main className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">
          <p className="text-sm text-gray-500">Departamento Humano — <span className="font-semibold text-gray-900">Gestão de Pessoas</span></p>

          {/* Pipeline principal */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-stagger">
            <StatCard label="Inscrições ativas" value={totalPipeline} icon={Users} href={`/${slug}/inscricoes`} color="blue" />
            <StatCard label="Aguardando formulário" value={totalForms} icon={ClipboardList} href={`/${slug}/inscricoes`} color="orange" />
            <StatCard label="Obreiros p/ finalizar" value={staffToFinalize ?? 0} icon={Briefcase} href={`/${slug}/inscricoes?tab=obreiro`} color="purple" />
            <StatCard label="Referências pendentes" value={refsAwaiting ?? 0} icon={MessageSquare} href={`/${slug}/inscricoes`} color="pink" />
          </div>

          {/* Alertas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(urgentNoResponse ?? 0) > 0 && (
              <Link href={`/${slug}/inscricoes`} className="group flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                <AlertTriangle size={20} className="text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">{urgentNoResponse} inscrição(ões) sem resposta há +3 dias</p>
                  <p className="text-xs text-red-600 mt-0.5">Verificar e dar andamento</p>
                </div>
              </Link>
            )}
            {(upcomingVisitors ?? 0) > 0 && (
              <Link href={`/${slug}/reservas`} className="group flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                <BedDouble size={20} className="text-blue-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">{upcomingVisitors} chegada(s) prevista(s)</p>
                  <p className="text-xs text-blue-600 mt-0.5">Reservas aprovadas a partir de hoje</p>
                </div>
              </Link>
            )}
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href={`/${slug}/inscricoes`} className="group bg-white rounded-xl border border-gray-200 p-4 text-center transition-all hover:shadow-md hover:-translate-y-0.5">
              <GraduationCap size={20} className="text-brand-500 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-gray-700 group-hover:text-brand-600">Inscrições</p>
            </Link>
            <Link href={`/${slug}/obreiros`} className="group bg-white rounded-xl border border-gray-200 p-4 text-center transition-all hover:shadow-md hover:-translate-y-0.5">
              <Briefcase size={20} className="text-brand-500 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-gray-700 group-hover:text-brand-600">Obreiros</p>
            </Link>
            <Link href={`/${slug}/pessoas`} className="group bg-white rounded-xl border border-gray-200 p-4 text-center transition-all hover:shadow-md hover:-translate-y-0.5">
              <Users size={20} className="text-brand-500 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-gray-700 group-hover:text-brand-600">Pessoas</p>
            </Link>
            <Link href={`/${slug}/presenca`} className="group bg-white rounded-xl border border-gray-200 p-4 text-center transition-all hover:shadow-md hover:-translate-y-0.5">
              <CheckCircle2 size={20} className="text-brand-500 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-gray-700 group-hover:text-brand-600">Presença</p>
            </Link>
          </div>
        </main>
      </>
    )
  }

  if (isEtedLeader) {
    const scopedSchoolIds = etedSchoolIds.length > 0 ? etedSchoolIds : ['no-match']
    const sbAdminScoped = createAdminClient()
    const [{ count: classCount }, { count: pendingInterests }, { count: pendingStudentApps }, { data: activeClasses }] = await Promise.all([
      supabase.from('school_classes')
        .select('*', { count: 'exact', head: true })
        .in('school_id', scopedSchoolIds)
        .gte('ends_at', today),
      sbAdminScoped.from('school_interest_forms')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('school_id', scopedSchoolIds)
        .not('status', 'in', '("convertido","descartado")'),
      supabase.from('student_applications')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('school_id', scopedSchoolIds)
        .in('status', ['pendente', 'em_analise']),
      supabase.from('school_classes')
        .select('id, name, year, semester, starts_at, ends_at, max_students, schools(name)')
        .in('school_id', scopedSchoolIds)
        .gte('ends_at', today)
        .order('starts_at', { ascending: true })
        .limit(5),
    ])

    return (
      <>
        <Header title="Dashboard" />
        <main className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-stagger">
            <StatCard label="Turmas ativas" value={classCount ?? 0} icon={BookOpen} href={`/${slug}/escolas`} color="orange" />
            <StatCard label="Pré-inscrições" value={pendingInterests ?? 0} icon={ClipboardList} href={`/${slug}/inscricoes`} color="blue" />
            <StatCard label="Inscrições em análise" value={pendingStudentApps ?? 0} icon={GraduationCap} href={`/${slug}/inscricoes`} color="purple" />
          </div>

          <SectionCard title="Turmas da sua escola" href={`/${slug}/escolas`} linkLabel="Ver escolas">
            {!activeClasses || activeClasses.length === 0 ? (
              <EmptyState icon={BookOpen} label="Nenhuma turma ativa na sua escola" />
            ) : (
              <div className="divide-y divide-gray-100">
                {activeClasses.map((c) => {
                  const school = c.schools as unknown as { name: string } | null
                  const start = c.starts_at
                    ? new Date(c.starts_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                    : null
                  const end = c.ends_at
                    ? new Date(c.ends_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                    : null
                  return (
                    <div key={c.id} className="flex items-start justify-between py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{school?.name ?? 'Escola'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.name}{start && end && ` · ${start} – ${end}`}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium">
                        ativa
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </main>
      </>
    )
  }

  if (!isManagement) {
    return (
      <>
        <Header title="Dashboard" />
        <main className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">
          <SectionCard title="Minha área">
            <EmptyState icon={LayoutDashboard} label="Nenhum painel específico configurado para este perfil" />
          </SectionCard>
        </main>
      </>
    )
  }

  // ── Main queries ────────────────────────────────────────────
  const sbAdmin = createAdminClient()

  const [
    { count: peopleCount },
    { count: staffCount },
    { count: studentCount },
    { count: schoolCount },
    { count: ministryCount },
    { count: pendingInterests },
    { count: pendingStaffApps },
    { count: pendingStudentApps },
    { count: pendingMinistryReqs },
    { count: pendingServiceReqs },
    { data: pendingMealRows },
    { count: pendingReservations },
    { data: activeClasses },
    { data: financeiro },
  ] = await Promise.all([
    supabase.from('people').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('staff_profiles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('active', true),
    supabase.from('student_profiles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('active', true),
    supabase.from('schools').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('active', true),
    supabase.from('ministries').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('active', true),
    sbAdmin.from('school_interest_forms').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).not('status', 'in', '("convertido","descartado")'),
    supabase.from('staff_applications').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', ['pendente', 'em_analise']),
    supabase.from('student_applications').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', ['pendente', 'em_analise']),
    supabase.from('ministry_pending_requests').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pendente'),
    supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', ['pendente', 'em_analise']),
    sbAdmin.from('kitchen_meal_consumers').select('purchase_group_id').eq('organization_id', orgId).eq('payment_status', 'pending'),
    sbAdmin.from('reservations').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pendente'),
    supabase
      .from('school_classes')
      .select('id, name, year, semester, starts_at, ends_at, max_students, schools!inner(name, organization_id)')
      .eq('schools.organization_id', orgId)
      .gte('ends_at', today)
      .order('starts_at', { ascending: true })
      .limit(5),
    (() => {
      const d = new Date(); d.setMonth(d.getMonth() - 5)
      return supabase
        .from('financial_transactions')
        .select('amount, type, date')
        .eq('organization_id', orgId)
        .gte('date', new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0])
    })(),
  ])

  const pendingMeals = new Set((pendingMealRows ?? []).map((r: { purchase_group_id: string }) => r.purchase_group_id)).size

  // ── Presença atual ─────────────────────────────────────────
  type PresenceRow = { people: unknown }
  let presentNow: PresenceRow[] = []
  try {
    const { data: pData } = await sbAdmin
      .from('person_presence')
      .select('people(full_name)')
      .eq('organization_id', orgId)
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: false })
      .limit(12)
    presentNow = (pData ?? []) as PresenceRow[]
  } catch { /* tabela ainda não existe — migration pendente */ }

  // ── Donut chart: interest forms (role-scoped) ───────────────
  const interestQuery = sbAdmin
    .from('school_interest_forms')
    .select('status')
    .eq('organization_id', orgId)
    .not('status', 'in', '("convertido","descartado")')

  const scopedInterestQuery = isEtedLeader
    ? interestQuery.in('school_id', etedSchoolIds.length > 0 ? etedSchoolIds : ['no-match'])
    : interestQuery

  const { data: interestRaw } = await scopedInterestQuery

  const interestCounts: Record<string, number> = {}
  for (const row of interestRaw ?? []) {
    interestCounts[row.status] = (interestCounts[row.status] ?? 0) + 1
  }

  // Only pre-conversion statuses (converted people are already in person_status_history)
  const PRE_REGISTRATION_STATUSES = [
    { key: 'pendente',            label: 'Pré-inscrição pendente', color: '#F59E0B' },
    { key: 'formulario_enviado',  label: 'Formulário enviado',     color: '#3B82F6' },
    { key: 'em_contato',          label: 'Em contato',             color: '#8B5CF6' },
  ] as const

  const interestSegments = PRE_REGISTRATION_STATUSES.map(s => ({
    label: s.label,
    value: interestCounts[s.key] ?? 0,
    color: s.color,
  }))

  // ── Donut chart: person statuses (role-scoped) ──────────────
  // For lider_eted: only people enrolled in their school's classes
  // For others: all people in the org (latest status per person)
  const personStatusCounts: Record<string, number> = {}

  if (isEtedLeader && etedSchoolIds.length > 0) {
    // Get class_ids for their schools
    const { data: classes } = await supabase
      .from('school_classes')
      .select('id')
      .in('school_id', etedSchoolIds)

    const classIds = classes?.map(c => c.id) ?? []

    if (classIds.length > 0) {
      // Get person_ids enrolled in those classes
      const { data: enrolled } = await supabase
        .from('class_students')
        .select('person_id')
        .in('class_id', classIds)
        .eq('status', 'ativo')

      const personIds = [...new Set(enrolled?.map(e => e.person_id) ?? [])]

      if (personIds.length > 0) {
        const effectiveStatusByPerson = new Map<string, string>()

        // Latest status for each enrolled person
        const { data: statusRows } = await supabase
          .from('person_status_history')
          .select('person_id, status, started_at')
          .in('person_id', personIds)
          .order('started_at', { ascending: false })

        for (const row of statusRows ?? []) {
          if (!effectiveStatusByPerson.has(row.person_id)) {
            effectiveStatusByPerson.set(row.person_id, row.status)
          }
        }

        for (const personId of personIds) {
          const status = effectiveStatusByPerson.get(personId) ?? 'aluno'
          personStatusCounts[status] = (personStatusCounts[status] ?? 0) + 1
        }
      }
    }
  } else if (!isEtedLeader) {
    const { data: peopleRows } = await supabase
      .from('people')
      .select('id, source')
      .eq('organization_id', orgId)

    const personIds = (peopleRows ?? [])
      .filter(person => person.source !== 'pre_inscricao_publica')
      .map(person => person.id)

    const [studentProfilesResult, staffProfilesResult] = await Promise.all([
      supabase
        .from('student_profiles')
        .select('person_id')
        .eq('organization_id', orgId)
        .eq('active', true),
      supabase
        .from('staff_profiles')
        .select('person_id')
        .eq('organization_id', orgId)
        .eq('active', true),
    ])

    const studentPersonIds = new Set((studentProfilesResult.data ?? []).map(row => row.person_id))
    const staffPersonIds = new Set((staffProfilesResult.data ?? []).map(row => row.person_id))
    const effectiveStatusByPerson = new Map<string, string>()

    // All people in the org — latest status per person
    const { data: statusRows } = await supabase
      .from('person_status_history')
      .select('person_id, status, started_at')
      .in('person_id', personIds.length > 0 ? personIds : ['no-match'])
      .order('started_at', { ascending: false })

    for (const row of statusRows ?? []) {
      if (!effectiveStatusByPerson.has(row.person_id)) {
        effectiveStatusByPerson.set(row.person_id, row.status)
      }
    }

    for (const personId of personIds) {
      const status = staffPersonIds.has(personId)
        ? 'obreiro'
        : studentPersonIds.has(personId)
          ? 'aluno'
          : effectiveStatusByPerson.get(personId) ?? 'sem_status'

      personStatusCounts[status] = (personStatusCounts[status] ?? 0) + 1
    }
  }

  const personSegments = PERSON_STATUSES.map(s => ({
    label: s.label,
    value: personStatusCounts[s.key] ?? 0,
    color: s.color,
  }))

  // Combined: pré-inscrição (not yet converted) + registered people
  const combinedSegments = [...interestSegments, ...personSegments]

  // ── Financial summary ───────────────────────────────────────
  type Lancamento = { amount: number; type: string; date: string }
  const lancamentos: Lancamento[] = financeiro ?? []
  const curMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const curMonthLanc = lancamentos.filter(l => l.date >= curMonthStart)
  const receitas = curMonthLanc.filter(l => l.type === 'income').reduce((s, l) => s + (l.amount ?? 0), 0)
  const despesas = curMonthLanc.filter(l => l.type === 'expense').reduce((s, l) => s + (l.amount ?? 0), 0)
  const saldo = receitas - despesas
  const temFinanceiro = lancamentos.length > 0
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Dados mensais para o gráfico de barras (últimos 6 meses)
  const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const financeByMonth: { month: string; income: number; expense: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    const y = d.getFullYear(), m = d.getMonth()
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const nextM = m === 11 ? `${y + 1}-01-01` : `${y}-${String(m + 2).padStart(2, '0')}-01`
    const monthLanc = lancamentos.filter(l => l.date >= start && l.date < nextM)
    financeByMonth.push({
      month: MONTH_NAMES[m],
      income: monthLanc.filter(l => l.type === 'income').reduce((s, l) => s + (l.amount ?? 0), 0),
      expense: monthLanc.filter(l => l.type === 'expense').reduce((s, l) => s + (l.amount ?? 0), 0),
    })
  }

  const totalPending = (pendingInterests ?? 0) + (pendingStaffApps ?? 0) + (pendingStudentApps ?? 0)
    + (pendingMinistryReqs ?? 0) + (pendingServiceReqs ?? 0) + pendingMeals + (pendingReservations ?? 0)

  // Donut chart title (scope label)
  const chartScope = isEtedLeader
    ? etedSchoolNames.length > 0 ? etedSchoolNames.join(', ') : 'Sua escola'
    : org?.name ?? 'Base'

  return (
    <>
      <Header title="Dashboard" />
      <main className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">

        {/* ── Stat Cards ─────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-stagger">
          <StatCard label="Pessoas" value={peopleCount ?? 0} icon={Users} href={`/${slug}/pessoas`} color="blue" />
          <StatCard label="Obreiros" value={staffCount ?? 0} icon={Briefcase} href={`/${slug}/obreiros`} color="green" />
          <StatCard label="Alunos" value={studentCount ?? 0} icon={GraduationCap} href={`/${slug}/pessoas`} color="purple" />
          <StatCard label="Escolas" value={schoolCount ?? 0} icon={BookOpen} href={`/${slug}/escolas`} color="orange" />
          <StatCard label="Ministérios" value={ministryCount ?? 0} icon={Music} href={`/${slug}/ministerios`} color="pink" />
        </div>

        {/* ── Alerta de pendências ────────────────────── */}
        {totalPending > 0 && (
          <Link
            href={`/${slug}/pendentes`}
            className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors"
          >
            <AlertTriangle className="size-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {totalPending} {totalPending === 1 ? 'item pendente' : 'itens pendentes'} aguardando sua atenção
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {[
                  pendingInterests ? `${pendingInterests} interesse${(pendingInterests ?? 0) > 1 ? 's' : ''} de inscrição` : null,
                  pendingStaffApps ? `${pendingStaffApps} candidatura${(pendingStaffApps ?? 0) > 1 ? 's' : ''} de obreiro` : null,
                  pendingStudentApps ? `${pendingStudentApps} inscrição${(pendingStudentApps ?? 0) > 1 ? 'ões' : ''} de escola` : null,
                  pendingMinistryReqs ? `${pendingMinistryReqs} pedido${(pendingMinistryReqs ?? 0) > 1 ? 's' : ''} de ministério` : null,
                  pendingServiceReqs ? `${pendingServiceReqs} solicitação${(pendingServiceReqs ?? 0) > 1 ? 'ões' : ''} de serviço` : null,
                  pendingMeals ? `${pendingMeals} refeição${pendingMeals > 1 ? 'ões' : ''} pendente${pendingMeals > 1 ? 's' : ''}` : null,
                  pendingReservations ? `${pendingReservations} reserva${(pendingReservations ?? 0) > 1 ? 's' : ''} pendente${(pendingReservations ?? 0) > 1 ? 's' : ''}` : null,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className="text-amber-500 text-lg">→</span>
          </Link>
        )}

        {/* ── Grid principal ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Pendências detalhadas */}
          <SectionCard title="Pendências" badge={totalPending} href={`/${slug}/pendentes`} linkLabel="Ver todas">
            {totalPending === 0 ? (
              <EmptyState icon={CheckCircle2} label="Nenhuma pendência" />
            ) : (
              <div className="space-y-1">
                {(pendingInterests ?? 0) > 0 && (
                  <PendingRow icon={ClipboardList} label="Interesses de inscrição" count={pendingInterests ?? 0} href={`/${slug}/inscricoes`} />
                )}
                {(pendingStaffApps ?? 0) > 0 && (
                  <PendingRow icon={Briefcase} label="Candidaturas de obreiro" count={pendingStaffApps ?? 0} href={`/${slug}/pendentes`} />
                )}
                {(pendingStudentApps ?? 0) > 0 && (
                  <PendingRow icon={GraduationCap} label="Inscrições de escola" count={pendingStudentApps ?? 0} href={`/${slug}/inscricoes`} />
                )}
                {(pendingMinistryReqs ?? 0) > 0 && (
                  <PendingRow icon={MessageSquare} label="Pedidos de ministério" count={pendingMinistryReqs ?? 0} href={`/${slug}/pendentes`} />
                )}
                {(pendingServiceReqs ?? 0) > 0 && (
                  <PendingRow icon={Wrench} label="Solicitações de serviço" count={pendingServiceReqs ?? 0} href={`/${slug}/pendentes`} />
                )}
                {pendingMeals > 0 && (
                  <PendingRow icon={UtensilsCrossed} label="Refeições sem pagamento" count={pendingMeals} href={`/${slug}/pendentes`} />
                )}
                {(pendingReservations ?? 0) > 0 && (
                  <PendingRow icon={BedDouble} label="Reservas pendentes" count={pendingReservations ?? 0} href={`/${slug}/reservas`} />
                )}
              </div>
            )}
          </SectionCard>

          {/* Turmas ativas */}
          <SectionCard title="Turmas ativas" href={`/${slug}/escolas`} linkLabel="Ver escolas">
            {!activeClasses || activeClasses.length === 0 ? (
              <EmptyState icon={BookOpen} label="Nenhuma turma ativa" />
            ) : (
              <div className="divide-y divide-gray-100">
                {activeClasses.map((c) => {
                  const school = c.schools as unknown as { name: string }
                  const start = c.starts_at
                    ? new Date(c.starts_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                    : null
                  const end = c.ends_at
                    ? new Date(c.ends_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                    : null
                  return (
                    <div key={c.id} className="flex items-start justify-between py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{school?.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.name}{start && end && ` · ${start} – ${end}`}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium">
                        ativa
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Na base agora */}
          <SectionCard title="Na base agora" badge={presentNow.length} href={`/${slug}/presenca`} linkLabel="Ver presença">
            {presentNow.length === 0 ? (
              <EmptyState icon={Home} label="Ninguém registrado na base" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {presentNow.map((p, i) => {
                  const ppl = p.people as { full_name?: string } | null
                  const name = ppl?.full_name ?? '—'
                  const initials = name.split(' ').slice(0, 2).map((n: string) => n[0]?.toUpperCase() ?? '').join('')
                  return (
                    <div key={i} title={name} className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-full px-2.5 py-1">
                      <div className="w-5 h-5 rounded-full bg-green-200 text-green-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials}
                      </div>
                      <span className="text-xs text-green-800 font-medium max-w-[90px] truncate">{name.split(' ')[0]}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Situação financeira */}
          <SectionCard
            title={`Financeiro — ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`}
            href={`/${slug}/financeiro`}
            linkLabel="Ver tudo"
          >
            {!temFinanceiro ? (
              <EmptyState icon={Wallet} label="Nenhum lançamento neste mês" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-bold">↑</span>
                    <span className="text-sm text-green-700 font-medium">Receitas</span>
                  </div>
                  <span className="text-sm font-bold text-green-700">{fmt(receitas)}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">↓</span>
                    <span className="text-sm text-red-600 font-medium">Despesas</span>
                  </div>
                  <span className="text-sm font-bold text-red-600">{fmt(despesas)}</span>
                </div>
                <div className={`flex items-center justify-between p-2.5 rounded-lg border ${saldo >= 0 ? 'bg-brand-50 border-brand-100' : 'bg-red-50 border-red-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${saldo >= 0 ? 'text-brand-600' : 'text-red-500'}`}>=</span>
                    <span className={`text-sm font-semibold ${saldo >= 0 ? 'text-brand-700' : 'text-red-600'}`}>Saldo</span>
                  </div>
                  <span className={`text-sm font-bold ${saldo >= 0 ? 'text-brand-700' : 'text-red-600'}`}>{fmt(saldo)}</span>
                </div>
              </div>
            )}
          </SectionCard>

        </div>

        {/* ── Gráficos ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard
            title="Gerenciamento de pessoas"
            href={`/${slug}/pessoas`}
            linkLabel="Ver pessoas"
          >
            <p className="text-xs text-gray-400 mb-4">
              Escopo: <span className="font-medium text-gray-600">{chartScope}</span>
              {' · '}inclui pré-inscrições e cadastrados
            </p>
            {combinedSegments.every(s => s.value === 0) ? (
              <EmptyState icon={Users} label="Nenhuma pessoa registrada" />
            ) : (
              <AnimatedDonutChart segments={combinedSegments} title="pessoas" />
            )}
          </SectionCard>

          <SectionCard
            title="Financeiro — últimos 6 meses"
            href={`/${slug}/financeiro`}
            linkLabel="Ver detalhes"
          >
            {financeByMonth.every(m => m.income === 0 && m.expense === 0) ? (
              <EmptyState icon={Wallet} label="Nenhum lançamento nos últimos 6 meses" />
            ) : (
              <FinancialMiniChart data={financeByMonth} />
            )}
          </SectionCard>
        </div>

      </main>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────

const colorMap = {
  blue:   { bg: 'bg-blue-50',    icon: 'text-blue-500',   num: 'text-blue-700',   label: 'text-blue-500'   },
  green:  { bg: 'bg-green-50',   icon: 'text-green-500',  num: 'text-green-700',  label: 'text-green-500'  },
  purple: { bg: 'bg-purple-50',  icon: 'text-purple-500', num: 'text-purple-700', label: 'text-purple-500' },
  orange: { bg: 'bg-brand-50',   icon: 'text-brand-500',  num: 'text-brand-700',  label: 'text-brand-500'  },
  pink:   { bg: 'bg-pink-50',    icon: 'text-pink-500',   num: 'text-pink-700',   label: 'text-pink-500'   },
  teal:   { bg: 'bg-teal-50',    icon: 'text-teal-500',   num: 'text-teal-700',   label: 'text-teal-500'   },
}

function StatCard({ label, value, icon: Icon, href, color }: {
  label: string; value: number; icon: LucideIcon; href: string; color: keyof typeof colorMap
}) {
  const c = colorMap[color]
  return (
    <Link href={href} className={`${c.bg} rounded-xl p-4 flex flex-col gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm`}>
      <Icon className={`size-6 ${c.icon}`} />
      <p className={`text-3xl font-bold leading-none ${c.num}`}><AnimatedNumber value={value} /></p>
      <p className={`text-xs font-semibold uppercase tracking-wide ${c.label}`}>{label}</p>
    </Link>
  )
}

function SectionCard({ title, children, badge, href, linkLabel }: {
  title: string; children: React.ReactNode; badge?: number; href?: string; linkLabel?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          {badge !== undefined && badge > 0 && (
            <span className="text-xs font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full leading-none">{badge}</span>
          )}
        </div>
        {href && linkLabel && (
          <Link href={href} className="text-xs text-brand-600 hover:underline font-medium">{linkLabel} →</Link>
        )}
      </div>
      <div className="p-4 flex-1">{children}</div>
    </div>
  )
}

function PendingRow({ icon: Icon, label, count, href }: { icon: LucideIcon; label: string; count: number; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-red-50 transition-colors group">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-gray-500 group-hover:text-red-600 transition-colors" />
        <span className="text-sm text-gray-700 group-hover:text-red-700 transition-colors">{label}</span>
      </div>
      <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{count}</span>
    </Link>
  )
}

function EmptyState({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2 text-gray-400">
      <Icon className="size-8 opacity-40" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
