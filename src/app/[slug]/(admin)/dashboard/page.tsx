import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { DonutChart } from '@/components/ui/DonutChart'
import Link from 'next/link'

type Props = { params: Promise<{ slug: string }> }


const PERSON_STATUSES = [
  { key: 'visitante',   label: 'Visitante',   color: '#67E8F9' },
  { key: 'candidato',   label: 'Candidato',   color: '#60A5FA' },
  { key: 'aluno',       label: 'Aluno',       color: '#A78BFA' },
  { key: 'obreiro',     label: 'Obreiro',     color: '#34D399' },
  { key: 'voluntario',  label: 'Voluntário',  color: '#F47920' },
  { key: 'associado',   label: 'Associado',   color: '#F472B6' },
  { key: 'inativo',     label: 'Inativo',     color: '#D1D5DB' },
] as const

export default async function BaseDashboard({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .single()

  const orgId = org?.id ?? ''
  const today = new Date().toISOString()

  // ── Discover current user role ──────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()

  const { data: orgUserData } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', user?.id ?? '')
    .eq('organization_id', orgId)
    .eq('active', true)
    .single()

  const userRole = (orgUserData?.roles as unknown as { name: string } | null)?.name ?? ''
  const isEtedLeader = userRole === 'lider_eted'

  // For lider_eted: discover their assigned school IDs
  let etedSchoolIds: string[] = []
  let etedSchoolNames: string[] = []

  if (isEtedLeader) {
    const { data: mySchools } = await supabase
      .from('school_leaders')
      .select('school_id, schools(name)')
      .eq('user_id', user?.id ?? '')
      .eq('organization_id', orgId)

    etedSchoolIds = mySchools?.map(s => s.school_id) ?? []
    etedSchoolNames = mySchools?.map(s => (s.schools as unknown as { name: string })?.name).filter(Boolean) ?? []
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
    { data: activeClasses },
    { data: financeiro },
  ] = await Promise.all([
    supabase.from('people').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('staff_profiles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('active', true),
    supabase.from('student_profiles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('active', true),
    supabase.from('schools').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('active', true),
    supabase.from('ministries').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('active', true),
    sbAdmin.from('school_interest_forms').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pendente'),
    supabase.from('staff_applications').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', ['pendente', 'em_analise']),
    supabase.from('student_applications').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', ['pendente', 'em_analise']),
    supabase
      .from('school_classes')
      .select('id, name, year, semester, starts_at, ends_at, max_students, schools!inner(name, organization_id)')
      .eq('schools.organization_id', orgId)
      .gte('ends_at', today)
      .order('starts_at', { ascending: true })
      .limit(5),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('financial_transactions')
      .select('amount, type, status')
      .eq('organization_id', orgId)
      .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
  ])

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
  let personStatusCounts: Record<string, number> = {}

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
        // Latest status for each enrolled person
        const { data: statusRows } = await supabase
          .from('person_status_history')
          .select('person_id, status, created_at')
          .in('person_id', personIds)
          .order('created_at', { ascending: false })

        const seen = new Set<string>()
        for (const row of statusRows ?? []) {
          if (!seen.has(row.person_id)) {
            seen.add(row.person_id)
            personStatusCounts[row.status] = (personStatusCounts[row.status] ?? 0) + 1
          }
        }
      }
    }
  } else if (!isEtedLeader) {
    // All people in the org — latest status per person
    const { data: statusRows } = await supabase
      .from('person_status_history')
      .select('person_id, status, created_at, people!inner(organization_id)')
      .eq('people.organization_id', orgId)
      .order('created_at', { ascending: false })

    const seen = new Set<string>()
    for (const row of statusRows ?? []) {
      if (!seen.has(row.person_id)) {
        seen.add(row.person_id)
        personStatusCounts[row.status] = (personStatusCounts[row.status] ?? 0) + 1
      }
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
  type Lancamento = { amount: number; type: string; status: string }
  const lancamentos: Lancamento[] = financeiro ?? []
  const receitas = lancamentos.filter(l => l.type === 'income').reduce((s, l) => s + (l.amount ?? 0), 0)
  const despesas = lancamentos.filter(l => l.type === 'expense').reduce((s, l) => s + (l.amount ?? 0), 0)
  const saldo = receitas - despesas
  const temFinanceiro = lancamentos.length > 0
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const totalPending = (pendingInterests ?? 0) + (pendingStaffApps ?? 0) + (pendingStudentApps ?? 0)

  // Donut chart title (scope label)
  const chartScope = isEtedLeader
    ? etedSchoolNames.length > 0 ? etedSchoolNames.join(', ') : 'Sua ETED'
    : org?.name ?? 'Base'

  return (
    <>
      <Header title="Dashboard" />
      <main className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">

        {/* ── Stat Cards ─────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Pessoas" value={peopleCount ?? 0} icon="👥" href={`/${slug}/pessoas`} color="blue" />
          <StatCard label="Obreiros" value={staffCount ?? 0} icon="⛪" href={`/${slug}/pessoas`} color="green" />
          <StatCard label="Alunos" value={studentCount ?? 0} icon="🎓" href={`/${slug}/pessoas`} color="purple" />
          <StatCard label="Escolas" value={schoolCount ?? 0} icon="📚" href={`/${slug}/escolas`} color="orange" />
          <StatCard label="Ministérios" value={ministryCount ?? 0} icon="🎵" href={`/${slug}/ministerios`} color="pink" />
        </div>

        {/* ── Alerta de pendências ────────────────────── */}
        {totalPending > 0 && (
          <Link
            href={`/${slug}/pendentes`}
            className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors"
          >
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {totalPending} {totalPending === 1 ? 'item pendente' : 'itens pendentes'} aguardando sua atenção
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {[
                  pendingInterests ? `${pendingInterests} interesse${pendingInterests > 1 ? 's' : ''} de inscrição` : null,
                  pendingStaffApps ? `${pendingStaffApps} candidatura${pendingStaffApps > 1 ? 's' : ''} de obreiro` : null,
                  pendingStudentApps ? `${pendingStudentApps} inscrição${pendingStudentApps > 1 ? 's' : ''} de escola` : null,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className="text-amber-500 text-lg">→</span>
          </Link>
        )}

        {/* ── Grid principal ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Pendências detalhadas */}
          <SectionCard title="Pendências" badge={totalPending} href={`/${slug}/pendentes`} linkLabel="Ver todas">
            {totalPending === 0 ? (
              <EmptyState icon="✅" label="Nenhuma pendência" />
            ) : (
              <div className="space-y-1">
                {(pendingInterests ?? 0) > 0 && (
                  <PendingRow icon="📋" label="Interesses de inscrição" count={pendingInterests ?? 0} href={`/${slug}/inscricoes`} />
                )}
                {(pendingStaffApps ?? 0) > 0 && (
                  <PendingRow icon="⛪" label="Candidaturas de obreiro" count={pendingStaffApps ?? 0} href={`/${slug}/pessoas`} />
                )}
                {(pendingStudentApps ?? 0) > 0 && (
                  <PendingRow icon="🎓" label="Inscrições de escola" count={pendingStudentApps ?? 0} href={`/${slug}/inscricoes`} />
                )}
              </div>
            )}
          </SectionCard>

          {/* Turmas ativas */}
          <SectionCard title="Turmas ativas" href={`/${slug}/escolas`} linkLabel="Ver escolas">
            {!activeClasses || activeClasses.length === 0 ? (
              <EmptyState icon="📚" label="Nenhuma turma ativa" />
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

          {/* Situação financeira */}
          <SectionCard
            title={`Financeiro — ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`}
            href={`/${slug}/financeiro`}
            linkLabel="Ver tudo"
          >
            {!temFinanceiro ? (
              <EmptyState icon="💰" label="Nenhum lançamento neste mês" />
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

        {/* ── Gráfico de pessoas ─────────────────────── */}
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
            <EmptyState icon="👥" label="Nenhuma pessoa registrada" />
          ) : (
            <DonutChart segments={combinedSegments} title="pessoas" />
          )}
        </SectionCard>

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
}

function StatCard({ label, value, icon, href, color }: {
  label: string; value: number; icon: string; href: string; color: keyof typeof colorMap
}) {
  const c = colorMap[color]
  return (
    <Link href={href} className={`${c.bg} rounded-xl p-4 flex flex-col gap-2 hover:opacity-80 transition-opacity`}>
      <span className={`text-2xl leading-none ${c.icon}`}>{icon}</span>
      <p className={`text-3xl font-bold leading-none ${c.num}`}>{value.toLocaleString('pt-BR')}</p>
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

function PendingRow({ icon, label, count, href }: { icon: string; label: string; count: number; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-red-50 transition-colors group">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-sm text-gray-700 group-hover:text-red-700 transition-colors">{label}</span>
      </div>
      <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{count}</span>
    </Link>
  )
}

function EmptyState({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2 text-gray-400">
      <span className="text-2xl opacity-50">{icon}</span>
      <p className="text-sm">{label}</p>
    </div>
  )
}
