import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { SearchBar } from '@/components/ui/SearchBar'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { CheckInButton, CheckOutButton } from './PresencaButtons'
import { AusenciaModal, REASON_LABELS } from './AusenciaModal'
import { CalendarRange, Users, UserCheck } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string; tab?: string; data_inicial?: string; data_final?: string; ministerio?: string }>
}

type StaffForPlanning = {
  person_id: string
  full_name: string
  area: string | null
  role_title: string | null
  user_id: string | null
}

type ScopedVisibility = {
  visiblePersonIds: Set<string> | null
  absencePersonIds: Set<string> | null
  label: string
}

type AbsenceForPlanning = {
  person_id: string
  reason_type: string
  reason_notes: string | null
  start_date: string
  end_date: string
}

type PlanningSegment = {
  start: string
  end: string
  available: StaffForPlanning[]
  absent: Array<StaffForPlanning & { absence: AbsenceForPlanning }>
}

const SPECIAL_MINISTRIES: Record<string, { label: string; roleName: string }> = {
  dh: { label: 'DH', roleName: 'dh' },
  secretaria: { label: 'Secretaria', roleName: 'secretaria' },
  hospitalidade: { label: 'Hospitalidade', roleName: 'hospitalidade' },
  cozinha: { label: 'Cozinha', roleName: 'cozinha' },
}

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return dateKey(value)
}

function isDateKey(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function overlaps(absence: AbsenceForPlanning, start: string, end: string) {
  return absence.start_date <= end && absence.end_date >= start
}

function buildPlanningSegments(staff: StaffForPlanning[], absences: AbsenceForPlanning[], start: string, end: string): PlanningSegment[] {
  const endExclusive = addDays(end, 1)
  const points = new Set<string>([start, endExclusive])

  for (const absence of absences) {
    if (!overlaps(absence, start, end)) continue
    if (absence.start_date > start) points.add(absence.start_date)
    const afterEnd = addDays(absence.end_date, 1)
    if (afterEnd > start && afterEnd < endExclusive) points.add(afterEnd)
  }

  const sortedPoints = [...points].sort()
  const byPersonAbsences = new Map<string, AbsenceForPlanning[]>()
  for (const absence of absences) {
    const list = byPersonAbsences.get(absence.person_id) ?? []
    list.push(absence)
    byPersonAbsences.set(absence.person_id, list)
  }

  return sortedPoints.slice(0, -1).map((segmentStart, index) => {
    const segmentEnd = addDays(sortedPoints[index + 1], -1)
    const absent = staff.flatMap(person => {
      const absence = (byPersonAbsences.get(person.person_id) ?? []).find(item => overlaps(item, segmentStart, segmentEnd))
      return absence ? [{ ...person, absence }] : []
    })
    const absentIds = new Set(absent.map(person => person.person_id))
    const available = staff.filter(person => !absentIds.has(person.person_id))
    return { start: segmentStart, end: segmentEnd, available, absent }
  })
}

function unionSets(...sets: Array<Set<string>>) {
  const result = new Set<string>()
  for (const set of sets) {
    for (const value of set) result.add(value)
  }
  return result
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('')
}

export default async function PresencaPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { q, tab = 'presentes', data_inicial, data_final, ministerio = 'todos' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!org) notFound()
  const orgId = org.id

  const db = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const defaultEnd = addDays(today, 13)
  const rangeStartRaw = isDateKey(data_inicial) ? data_inicial! : today
  const rangeEndRaw = isDateKey(data_final) ? data_final! : defaultEnd
  const rangeStart = rangeStartRaw <= rangeEndRaw ? rangeStartRaw : rangeEndRaw
  const rangeEnd = rangeStartRaw <= rangeEndRaw ? rangeEndRaw : rangeStartRaw

  const [
    { data: orgUser },
    { data: people },
    { data: activePresences },
    { data: todayHistory },
    { data: activeDeclarationsRaw },
    { data: upcomingDeclarationsRaw },
    { data: staffRaw },
    { data: ministriesRaw },
    { data: ministryMembersRaw },
    { data: schoolStaffRaw },
    { data: schoolLeadersRaw },
    { data: ministryLeadersRaw },
    { data: currentStaffProfile },
    { data: orgUsersRaw },
    { data: rangeAbsencesRaw },
  ] = await Promise.all([
    supabase
      .from('organization_users')
      .select('roles(name)')
      .eq('user_id', user?.id ?? '')
      .eq('active', true)
      .single(),

    db.from('people')
      .select('id, full_name, source')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('full_name'),

    db.from('person_presence')
      .select('id, person_id, checked_in_at')
      .eq('organization_id', orgId)
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: false }),

    db.from('person_presence')
      .select('person_id')
      .eq('organization_id', orgId)
      .gte('checked_in_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .not('checked_out_at', 'is', null),

    db.from('absence_declarations')
      .select('person_id, reason_type, reason_notes, start_date, end_date')
      .eq('organization_id', orgId)
      .lte('start_date', today)
      .gte('end_date', today),

    db.from('absence_declarations')
      .select('id, person_id, reason_type, reason_notes, start_date, end_date, people(full_name)')
      .eq('organization_id', orgId)
      .gt('start_date', today)
      .lte('start_date', new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
      .order('start_date'),

    db.from('staff_profiles')
      .select('person_id, user_id, role_title, area, people(full_name)')
      .eq('organization_id', orgId)
      .eq('active', true),

    db.from('ministries')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),

    db.from('ministry_members')
      .select('ministry_id, person_id, active')
      .eq('active', true),

    db.from('school_staff')
      .select('school_id, person_id, active, schools!inner(name, organization_id)')
      .eq('active', true)
      .eq('schools.organization_id', orgId),

    db.from('school_leaders')
      .select('school_id, user_id, schools!inner(name, organization_id)')
      .eq('organization_id', orgId),

    db.from('ministry_leaders')
      .select('ministry_id, user_id, ministries!inner(name, organization_id)')
      .eq('organization_id', orgId),

    db.from('staff_profiles')
      .select('person_id, area, role_title')
      .eq('organization_id', orgId)
      .eq('user_id', user?.id ?? '')
      .maybeSingle(),

    db.from('organization_users')
      .select('user_id, roles(name)')
      .eq('organization_id', orgId)
      .eq('active', true),

    db.from('absence_declarations')
      .select('person_id, reason_type, reason_notes, start_date, end_date')
      .eq('organization_id', orgId)
      .lte('start_date', rangeEnd)
      .gte('end_date', rangeStart),
  ])
  const role = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''
  const canPlanScale = role === 'dh' || role === 'superadmin'

  const allPeople = (people ?? []) as Array<{ id: string; full_name: string; source: string | null }>

  const presenceByPerson = new Map(
    (activePresences ?? []).map(p => [p.person_id, { id: p.id, since: p.checked_in_at }])
  )

  const checkedOutTodayIds = new Set((todayHistory ?? []).map(p => p.person_id))

  type DeclRow = { person_id: string; reason_type: string; reason_notes: string | null; start_date: string; end_date: string }
  const declarationMap = new Map(
    (activeDeclarationsRaw ?? [] as DeclRow[]).map((d: DeclRow) => [d.person_id, d])
  )

  type UpcomingRaw = { id: string; person_id: string; reason_type: string; reason_notes: string | null; start_date: string; end_date: string; people: { full_name: string }[] | null }
  const upcoming = ((upcomingDeclarationsRaw ?? []) as unknown as UpcomingRaw[]).map(d => ({
    id: d.id,
    person_id: d.person_id,
    full_name: (Array.isArray(d.people) ? d.people[0]?.full_name : (d.people as { full_name: string } | null)?.full_name) ?? '—',
    start_date: d.start_date,
    end_date: d.end_date,
    reason_type: d.reason_type,
    reason_notes: d.reason_notes,
  }))

  type StaffRaw = {
    person_id: string
    user_id: string | null
    role_title: string | null
    area: string | null
    people: { full_name: string }[] | { full_name: string } | null
  }
  const staff = ((staffRaw ?? []) as unknown as StaffRaw[])
    .map(s => ({
      person_id: s.person_id,
      user_id: s.user_id,
      role_title: s.role_title,
      area: s.area,
      full_name: (Array.isArray(s.people) ? s.people[0]?.full_name : (s.people as { full_name: string } | null)?.full_name) ?? '—',
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  const ministries = (ministriesRaw ?? []) as Array<{ id: string; name: string }>
  const ministryMembers = (ministryMembersRaw ?? []) as Array<{ ministry_id: string; person_id: string; active: boolean }>
  type SchoolStaffRow = { school_id: string; person_id: string; schools: { name: string } | null }
  type SchoolLeaderRow = { school_id: string; user_id: string; schools: { name: string } | null }
  type MinistryLeaderRow = { ministry_id: string; user_id: string; ministries: { name: string } | null }
  const schoolStaff = (schoolStaffRaw ?? []) as unknown as SchoolStaffRow[]
  const schoolLeaders = (schoolLeadersRaw ?? []) as unknown as MinistryLeaderRow[] as unknown as SchoolLeaderRow[]
  const ministryLeaders = (ministryLeadersRaw ?? []) as unknown as MinistryLeaderRow[]
  const roleByUserId = new Map(((orgUsersRaw ?? []) as unknown as Array<{ user_id: string; roles: { name: string } | null }>)
    .map(row => [row.user_id, row.roles?.name ?? '']))
  const currentPersonId = (currentStaffProfile as { person_id: string | null } | null)?.person_id ?? null
  const fullAccess = ['superadmin', 'admin_base', 'lider_base', 'dh'].includes(role)

  const specialPersonIds = (specialKey: string) => {
    const special = SPECIAL_MINISTRIES[specialKey]
    if (!special) return new Set<string>()
    return new Set(staff
      .filter(person => normalize(person.area) === normalize(special.label) || roleByUserId.get(person.user_id ?? '') === special.roleName)
      .map(person => person.person_id))
  }

  const currentSpecialKey = Object.entries(SPECIAL_MINISTRIES)
    .find(([, special]) => special.roleName === role || normalize((currentStaffProfile as { area: string | null } | null)?.area) === normalize(special.label))?.[0] ?? null
  const currentSchoolIds = currentPersonId
    ? new Set(schoolStaff.filter(row => row.person_id === currentPersonId).map(row => row.school_id))
    : new Set<string>()
  for (const row of schoolLeaders.filter(row => row.user_id === user?.id)) currentSchoolIds.add(row.school_id)
  const currentMinistryIds = currentPersonId
    ? new Set(ministryMembers.filter(row => row.person_id === currentPersonId).map(row => row.ministry_id))
    : new Set<string>()
  for (const row of ministryLeaders.filter(row => row.user_id === user?.id)) currentMinistryIds.add(row.ministry_id)

  const schoolScopeIds = new Set(schoolStaff.filter(row => currentSchoolIds.has(row.school_id)).map(row => row.person_id))
  const ministryScopeIds = new Set(ministryMembers.filter(row => currentMinistryIds.has(row.ministry_id)).map(row => row.person_id))
  const specialScopeIds = currentSpecialKey ? specialPersonIds(currentSpecialKey) : new Set<string>()
  if (currentPersonId) {
    schoolScopeIds.add(currentPersonId)
    ministryScopeIds.add(currentPersonId)
    specialScopeIds.add(currentPersonId)
  }

  const visibleScope: ScopedVisibility = fullAccess
    ? { visiblePersonIds: null, absencePersonIds: null, label: 'Toda a base' }
    : {
      visiblePersonIds: unionSets(schoolScopeIds, ministryScopeIds, specialScopeIds),
      absencePersonIds: (role === 'lider_eted' || role === 'lider_ministerio' || currentSpecialKey)
        ? unionSets(schoolScopeIds, ministryScopeIds, specialScopeIds)
        : currentPersonId ? new Set([currentPersonId]) : new Set(),
      label: 'Sua área',
    }
  const specialMinistryOptions = Object.entries(SPECIAL_MINISTRIES).map(([key, item]) => ({ value: `especial:${key}`, label: item.label }))
  const ministryOptions = [
    { value: 'todos', label: 'Todos os ministérios' },
    ...specialMinistryOptions,
    ...ministries.map(ministry => ({ value: `ministerio:${ministry.id}`, label: ministry.name })),
  ]

  const staffForPlanning = staff.filter(person => {
    if (visibleScope.visiblePersonIds && !visibleScope.visiblePersonIds.has(person.person_id)) return false
    if (ministerio === 'todos') return true
    if (ministerio.startsWith('especial:')) {
      const special = SPECIAL_MINISTRIES[ministerio.replace('especial:', '')]
      if (!special) return true
      return normalize(person.area) === normalize(special.label) || roleByUserId.get(person.user_id ?? '') === special.roleName
    }
    if (ministerio.startsWith('ministerio:')) {
      const ministryId = ministerio.replace('ministerio:', '')
      const memberIds = new Set(ministryMembers.filter(member => member.ministry_id === ministryId).map(member => member.person_id))
      return memberIds.has(person.person_id)
    }
    return true
  })
  const planningAbsences = (rangeAbsencesRaw ?? []) as AbsenceForPlanning[]
  const planningSegments = buildPlanningSegments(staffForPlanning, planningAbsences, rangeStart, rangeEnd)
  const minAvailable = planningSegments.length ? Math.min(...planningSegments.map(segment => segment.available.length)) : staffForPlanning.length
  const maxAbsent = planningSegments.length ? Math.max(...planningSegments.map(segment => segment.absent.length)) : 0
  const selectedMinistryLabel = ministryOptions.find(option => option.value === ministerio)?.label ?? 'Todos os ministérios'
  const visiblePeople = visibleScope.visiblePersonIds
    ? allPeople.filter(person => visibleScope.visiblePersonIds!.has(person.id))
    : allPeople
  const scopedStaffForAbsence = staff
    .filter(person => !visibleScope.absencePersonIds || visibleScope.absencePersonIds.has(person.person_id))

  const present = visiblePeople.filter(p => presenceByPerson.has(p.id))
  const absent  = visiblePeople.filter(p => !presenceByPerson.has(p.id) && p.source !== 'pre_inscricao_publica')

  const listToShow = tab === 'presentes' ? present : absent
  const filtered = q
    ? listToShow.filter(p => p.full_name.toLowerCase().includes(q.toLowerCase()))
    : listToShow

  function formatSince(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(iso: string) {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <>
      <Header
        title="Presença na Base"
        mobileHeight="dashboard"
        actions={<AusenciaModal staff={scopedStaffForAbsence} orgId={orgId} slug={slug} upcoming={upcoming.filter(item => !visibleScope.visiblePersonIds || visibleScope.visiblePersonIds.has(item.person_id))} />}
      />
      <main className="space-y-4 p-4 md:p-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 animate-stagger">
          <div className="flex items-center gap-3 rounded-xl bg-green-50 p-4">
            <div className="rounded-lg bg-green-100 p-2">
              <UserCheck size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{present.length}</p>
              <p className="text-xs font-medium text-green-600">Na base agora</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
            <div className="rounded-lg bg-gray-100 p-2">
              <Users size={20} className="text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-700">{absent.length}</p>
              <p className="text-xs font-medium text-gray-500">Fora da base</p>
            </div>
          </div>
        </div>

        {canPlanScale && (
          <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                  <CalendarRange size={18} className="text-brand-500" />
                  Disponibilidade para escala
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {visibleScope.label}: obreiros ativos contam como disponíveis, exceto nos períodos com ausência declarada.
                </p>
              </div>
              <form className="grid w-full gap-2 md:w-auto md:grid-cols-[10rem_10rem_14rem_auto]">
                <input type="hidden" name="tab" value={tab} />
                {q && <input type="hidden" name="q" value={q} />}
                <input
                  name="data_inicial"
                  type="date"
                  defaultValue={rangeStart}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  name="data_final"
                  type="date"
                  defaultValue={rangeEnd}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <select
                  name="ministerio"
                  defaultValue={ministerio}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  {ministryOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
                  Ver
                </button>
              </form>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <ScaleStat label="Obreiros no filtro" value={staffForPlanning.length} />
              <ScaleStat label="Mínimo disponível" value={minAvailable} tone="green" />
              <ScaleStat label="Máximo ausente" value={maxAbsent} tone="red" />
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{selectedMinistryLabel}</span>
              <span>•</span>
              <span>{formatDate(rangeStart)} até {formatDate(rangeEnd)}</span>
            </div>

            {staffForPlanning.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                Nenhum obreiro ativo encontrado para este filtro.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Período</th>
                      <th className="px-3 py-2">Disponíveis</th>
                      <th className="px-3 py-2">Ausentes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {planningSegments.map(segment => (
                      <tr key={`${segment.start}-${segment.end}`}>
                        <td className="px-3 py-3 font-medium text-gray-900">
                          {formatDate(segment.start)}{segment.start !== segment.end ? ` → ${formatDate(segment.end)}` : ''}
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                            {segment.available.length}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {segment.absent.length === 0 ? (
                            <span className="text-xs text-gray-400">Ninguém ausente</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {segment.absent.map(person => {
                                const reason = REASON_LABELS[person.absence.reason_type] ?? REASON_LABELS.outro
                                return (
                                  <span key={person.person_id} className={`rounded-md px-2 py-1 text-xs font-medium ${reason.color}`} title={reason.label}>
                                    {person.full_name}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {[
            { key: 'presentes', label: `Presentes (${present.length})` },
            { key: 'ausentes',  label: `Ausentes (${absent.length})` },
          ].map(t => (
            <a
              key={t.key}
              href={`/${slug}/presenca?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>

        {/* Busca */}
        <Suspense>
          <SearchBar placeholder="Buscar por nome…" className="w-full sm:w-72" />
        </Suspense>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-sm text-gray-400">
              {q ? `Nenhum resultado para "${q}".` : tab === 'presentes' ? 'Ninguém na base no momento.' : 'Todos estão na base!'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {filtered.map(person => {
              const presence = presenceByPerson.get(person.id)
              const wasHereToday = checkedOutTodayIds.has(person.id)
              const declaration = declarationMap.get(person.id)
              const initials = getInitials(person.full_name)
              const reasonInfo = declaration ? (REASON_LABELS[declaration.reason_type] ?? REASON_LABELS.outro) : null

              return (
                <div key={person.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    presence ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{person.full_name}</p>
                    {presence && (
                      <p className="text-xs text-green-600">Desde {formatSince(presence.since)}</p>
                    )}
                    {!presence && reasonInfo && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${reasonInfo.color}`}>
                          {reasonInfo.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          Volta em {formatDate(declaration!.end_date)}
                        </span>
                      </div>
                    )}
                    {!presence && !reasonInfo && wasHereToday && (
                      <p className="text-xs text-gray-400">Esteve aqui hoje</p>
                    )}
                  </div>

                  {presence ? (
                    <CheckOutButton presenceId={presence.id} slug={slug} nome={person.full_name.split(' ')[0]} />
                  ) : (
                    <CheckInButton personId={person.id} orgId={orgId} slug={slug} nome={person.full_name.split(' ')[0]} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}

function ScaleStat({ label, value, tone = 'gray' }: { label: string; value: number; tone?: 'gray' | 'green' | 'red' }) {
  const colors = {
    gray: 'bg-gray-50 text-gray-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className={`rounded-lg p-3 ${colors[tone]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  )
}
