import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { notFound, redirect } from 'next/navigation'
import {
  CalendarWorkspace,
  type CalendarEvent,
  type SchoolOption,
} from './CalendarWorkspace'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ ano?: string }>
}

export default async function CalendarioPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { ano } = await searchParams
  const year = Number(ano) || new Date().getFullYear()
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .single()
  if (!org) notFound()

  const orgId = org.id
  const userId = user.id

  const { role, preview } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const canManageBase = role === 'superadmin' || role === 'admin_base' || role === 'lider_base'
  const canManageSchool = role === 'lider_eted'
  const canAddPrivateNote = true

  const leaderSchoolIds = canManageSchool
    ? preview?.schoolId
      ? [preview.schoolId]
      : ((await admin.from('school_leaders').select('school_id').eq('organization_id', orgId).eq('user_id', userId)).data ?? []).map(row => row.school_id as string)
    : []
  const studentSchoolIds = role === 'aluno'
    ? preview?.schoolId
      ? [preview.schoolId]
      : await getStudentSchoolIds(admin, orgId, userId, user.email ?? null)
    : []
  const scopedSchoolIds = canManageSchool ? leaderSchoolIds : role === 'aluno' ? studentSchoolIds : []
  const shouldScopeSchools = canManageSchool || role === 'aluno'

  const start = `${year}-01-01`
  const end = `${year}-12-31`
  const startAt = `${start}T00:00:00`
  const endAt = `${end}T23:59:59`

  const baseEventsQuery = admin
    .from('base_calendar_events')
    .select('id, title, description, event_type, starts_on, ends_on')
    .eq('organization_id', orgId)
    .gte('starts_on', start)
    .lte('starts_on', end)
    .order('starts_on', { ascending: true })

  let schoolEventsQuery = admin
    .from('school_calendar_events')
    .select('id, title, description, event_type, starts_at, ends_at, school_id, schools(name)')
    .eq('organization_id', orgId)
    .gte('starts_at', startAt)
    .lte('starts_at', endAt)
    .order('starts_at', { ascending: true })

  let classRowsQuery = supabase
    .from('school_classes')
    .select('id, name, starts_at, schools!inner(id, name, organization_id)')
    .eq('schools.organization_id', orgId)
    .gte('starts_at', start)
    .lte('starts_at', end)
    .order('starts_at', { ascending: true })

  if (shouldScopeSchools) {
    const ids = scopedSchoolIds.length > 0 ? scopedSchoolIds : ['no-match']
    schoolEventsQuery = schoolEventsQuery.in('school_id', ids)
    classRowsQuery = classRowsQuery.in('schools.id', ids)
  }

  const [{ data: baseRows }, { data: schoolRows }, { data: noteRows }, { data: classRows }, { data: schoolOptionsRows }] = await Promise.all([
    baseEventsQuery,
    schoolEventsQuery,
    admin
      .from('personal_calendar_notes')
      .select('id, title, notes, starts_at, ends_at')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .gte('starts_at', startAt)
      .lte('starts_at', endAt)
      .order('starts_at', { ascending: true }),
    classRowsQuery,
    canManageBase
      ? admin.from('schools').select('id, name').eq('organization_id', orgId).eq('active', true).order('name')
      : leaderSchoolIds.length > 0
        ? admin.from('schools').select('id, name').eq('organization_id', orgId).in('id', leaderSchoolIds).order('name')
        : Promise.resolve({ data: [] as SchoolOption[] }),
  ])

  const baseEvents: CalendarEvent[] = ((baseRows ?? []) as Array<{
    id: string
    title: string
    description: string | null
    event_type: 'evento' | 'feriado' | 'trimestre' | 'escola' | 'outro'
    starts_on: string
    ends_on: string | null
  }>).map(event => ({
    ...event,
    starts_at: null,
    ends_at: null,
    layer: 'base',
    source: 'manual',
  }))

  const schoolEvents: CalendarEvent[] = ((schoolRows ?? []) as unknown as Array<{
    id: string
    title: string
    description: string | null
    event_type: 'aula' | 'tema' | 'evento' | 'outro'
    starts_at: string
    ends_at: string | null
    school_id: string
    schools: { name: string } | null
  }>).map(event => ({
    id: event.id,
    title: event.title,
    description: event.description,
    event_type: event.event_type,
    starts_on: event.starts_at.slice(0, 10),
    starts_at: event.starts_at,
    ends_on: event.ends_at ? event.ends_at.slice(0, 10) : null,
    ends_at: event.ends_at,
    layer: 'escola',
    source: 'manual',
    school_id: event.school_id,
    school_name: event.schools?.name ?? null,
  }))

  const personalNotes: CalendarEvent[] = ((noteRows ?? []) as Array<{
    id: string
    title: string
    notes: string | null
    starts_at: string
    ends_at: string | null
  }>).map(note => ({
    id: note.id,
    title: note.title,
    description: note.notes,
    event_type: 'nota',
    starts_on: note.starts_at.slice(0, 10),
    starts_at: note.starts_at,
    ends_on: note.ends_at ? note.ends_at.slice(0, 10) : null,
    ends_at: note.ends_at,
    layer: 'pessoal',
    source: 'manual',
  }))

  const classEvents: CalendarEvent[] = ((classRows ?? []) as unknown as Array<{
    id: string
    name: string
    starts_at: string | null
    schools: { name: string } | null
  }>)
    .filter(row => row.starts_at)
    .map(row => ({
      id: `class:${row.id}`,
      title: `Início: ${row.schools?.name ?? 'Escola'} - ${row.name}`,
      description: null,
      event_type: 'escola',
      starts_on: row.starts_at as string,
      starts_at: null,
      ends_on: null,
      ends_at: null,
      layer: 'auto',
      source: 'auto',
      school_name: row.schools?.name ?? null,
    }))

  const events = [...baseEvents, ...schoolEvents, ...personalNotes, ...holidayEvents(year), ...classEvents]
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.title.localeCompare(b.title))

  const schoolOptions = (schoolOptionsRows ?? []) as SchoolOption[]

  async function createBaseEvent(formData: FormData) {
    'use server'
    if (!canManageBase) return
    const db = createAdminClient()
    const title = (formData.get('title') as string).trim()
    const startsOn = formData.get('starts_on') as string
    const eventType = formData.get('event_type') as string
    if (!title || !startsOn) return

    await db.from('base_calendar_events').insert({
      organization_id: orgId,
      title,
      description: ((formData.get('description') as string | null)?.trim() || null),
      event_type: eventType || 'evento',
      starts_on: startsOn,
      ends_on: (formData.get('ends_on') as string) || null,
      created_by: userId,
    })
    redirect(`/${slug}/calendario?ano=${year}`)
  }

  async function createSchoolEvent(formData: FormData) {
    'use server'
    if (!canManageBase && !canManageSchool) return
    const db = createAdminClient()
    const title = (formData.get('title') as string).trim()
    const schoolId = formData.get('school_id') as string
    const startsAt = formData.get('starts_at') as string
    const endsAt = formData.get('ends_at') as string
    const allowedSchoolIds = canManageBase ? null : leaderSchoolIds
    if (!title || !schoolId || !startsAt) return
    if (allowedSchoolIds && !allowedSchoolIds.includes(schoolId)) return

    await db.from('school_calendar_events').insert({
      organization_id: orgId,
      school_id: schoolId,
      title,
      description: ((formData.get('description') as string | null)?.trim() || null),
      event_type: (formData.get('event_type') as string) || 'aula',
      starts_at: localDateTimeToIso(startsAt),
      ends_at: endsAt ? localDateTimeToIso(endsAt) : null,
      created_by: userId,
    })
    redirect(`/${slug}/calendario?ano=${year}`)
  }

  async function createPersonalNote(formData: FormData) {
    'use server'
    if (!canAddPrivateNote) return
    const db = createAdminClient()
    const title = (formData.get('title') as string).trim()
    const startsAt = formData.get('starts_at') as string
    const endsAt = formData.get('ends_at') as string
    if (!title || !startsAt) return

    await db.from('personal_calendar_notes').insert({
      organization_id: orgId,
      user_id: userId,
      title,
      notes: ((formData.get('notes') as string | null)?.trim() || null),
      starts_at: localDateTimeToIso(startsAt),
      ends_at: endsAt ? localDateTimeToIso(endsAt) : null,
    })
    redirect(`/${slug}/calendario?ano=${year}`)
  }

  async function deleteEvent(formData: FormData) {
    'use server'
    const db = createAdminClient()
    const eventId = formData.get('event_id') as string
    const layer = formData.get('layer') as string

    if (layer === 'base' && canManageBase) {
      await db.from('base_calendar_events').delete().eq('organization_id', orgId).eq('id', eventId)
    }

    if (layer === 'escola' && (canManageBase || canManageSchool)) {
      let query = db.from('school_calendar_events').delete().eq('organization_id', orgId).eq('id', eventId)
      if (!canManageBase) query = query.in('school_id', leaderSchoolIds.length > 0 ? leaderSchoolIds : ['no-match'])
      await query
    }

    if (layer === 'pessoal' && canAddPrivateNote) {
      await db.from('personal_calendar_notes').delete().eq('organization_id', orgId).eq('user_id', userId).eq('id', eventId)
    }

    redirect(`/${slug}/calendario?ano=${year}`)
  }

  async function updateEvent(formData: FormData) {
    'use server'
    const db = createAdminClient()
    const eventId = formData.get('event_id') as string
    const layer = formData.get('layer') as string
    const title = (formData.get('title') as string).trim()
    if (!eventId || !title) return

    if (layer === 'base' && canManageBase) {
      const startsOn = formData.get('starts_on') as string
      if (!startsOn) return

      await db
        .from('base_calendar_events')
        .update({
          title,
          description: ((formData.get('description') as string | null)?.trim() || null),
          event_type: (formData.get('event_type') as string) || 'evento',
          starts_on: startsOn,
          ends_on: (formData.get('ends_on') as string) || null,
        })
        .eq('organization_id', orgId)
        .eq('id', eventId)
    }

    if (layer === 'escola' && (canManageBase || canManageSchool)) {
      const schoolId = formData.get('school_id') as string
      const startsAt = formData.get('starts_at') as string
      const endsAt = formData.get('ends_at') as string
      const allowedSchoolIds = canManageBase ? null : leaderSchoolIds
      if (!schoolId || !startsAt) return
      if (allowedSchoolIds && !allowedSchoolIds.includes(schoolId)) return

      let query = db
        .from('school_calendar_events')
        .update({
          school_id: schoolId,
          title,
          description: ((formData.get('description') as string | null)?.trim() || null),
          event_type: (formData.get('event_type') as string) || 'aula',
          starts_at: localDateTimeToIso(startsAt),
          ends_at: endsAt ? localDateTimeToIso(endsAt) : null,
        })
        .eq('organization_id', orgId)
        .eq('id', eventId)
      if (!canManageBase) query = query.in('school_id', leaderSchoolIds.length > 0 ? leaderSchoolIds : ['no-match'])
      await query
    }

    if (layer === 'pessoal' && canAddPrivateNote) {
      const startsAt = formData.get('starts_at') as string
      const endsAt = formData.get('ends_at') as string
      if (!startsAt) return

      await db
        .from('personal_calendar_notes')
        .update({
          title,
          notes: ((formData.get('notes') as string | null)?.trim() || null),
          starts_at: localDateTimeToIso(startsAt),
          ends_at: endsAt ? localDateTimeToIso(endsAt) : null,
        })
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .eq('id', eventId)
    }

    redirect(`/${slug}/calendario?ano=${year}`)
  }

  return (
    <>
      <Header title="Calendário" mobileSize="large" />
      <CalendarWorkspace
        year={year}
        slug={slug}
        events={events}
        schoolOptions={schoolOptions}
        permissions={{ canManageBase, canManageSchool, canAddPrivateNote }}
        actions={{ createBaseEvent, createSchoolEvent, createPersonalNote, updateEvent, deleteEvent }}
      />
    </>
  )
}

function sortKey(event: CalendarEvent) {
  return event.starts_at ?? `${event.starts_on}T00:00:00`
}

async function getStudentSchoolIds(
  db: ReturnType<typeof createAdminClient>,
  organizationId: string,
  userId: string,
  email: string | null
) {
  const personIds = new Set<string>()

  const { data: profilesByUser, error: profilesByUserError } = await db
    .from('student_profiles')
    .select('person_id, user_id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('active', true)

  if (!profilesByUserError) {
    for (const profile of (profilesByUser ?? []) as Array<{ person_id: string }>) {
      personIds.add(profile.person_id)
    }
  }

  if (email) {
    const { data: contacts } = await db
      .from('person_contacts')
      .select('person_id, people!inner(organization_id)')
      .eq('type', 'email')
      .eq('value', email)
      .eq('people.organization_id', organizationId)

    const contactPersonIds = ((contacts ?? []) as unknown as Array<{ person_id: string }>).map(contact => contact.person_id)

    if (contactPersonIds.length > 0) {
      const { data: activeStudentProfiles } = await db
        .from('student_profiles')
        .select('person_id')
        .eq('organization_id', organizationId)
        .eq('active', true)
        .in('person_id', contactPersonIds)

      for (const profile of (activeStudentProfiles ?? []) as Array<{ person_id: string }>) {
        personIds.add(profile.person_id)
      }
    }
  }

  if (personIds.size === 0) return []

  const personIdList = [...personIds]
  const schoolIds = new Set<string>()

  const { data: enrollments } = await db
    .from('class_students')
    .select('class_id')
    .in('person_id', personIdList)
    .eq('status', 'ativo')

  const classIds = [...new Set(((enrollments ?? []) as Array<{ class_id: string }>).map(row => row.class_id))]

  if (classIds.length > 0) {
    const { data: classes } = await db
      .from('school_classes')
      .select('id, school_id, schools!inner(organization_id)')
      .in('id', classIds)
      .eq('schools.organization_id', organizationId)

    for (const row of (classes ?? []) as unknown as Array<{ school_id: string | null }>) {
      if (row.school_id) schoolIds.add(row.school_id)
    }
  }

  const { data: applications } = await db
    .from('student_applications')
    .select('school_id')
    .eq('organization_id', organizationId)
    .in('person_id', personIdList)
    .eq('status', 'aprovado')

  for (const app of (applications ?? []) as Array<{ school_id: string | null }>) {
    if (app.school_id) schoolIds.add(app.school_id)
  }

  return [...schoolIds]
}

function localDateTimeToIso(value: string) {
  return new Date(value).toISOString()
}

function holidayEvents(year: number): CalendarEvent[] {
  const easterDate = easter(year)
  const holidays: Array<[string, string]> = [
    [`${year}-01-01`, 'Confraternizacao Universal'],
    [addDays(easterDate, -48), 'Carnaval'],
    [addDays(easterDate, -47), 'Carnaval'],
    [addDays(easterDate, -2), 'Sexta-feira Santa'],
    [toDateKeyFromDate(easterDate), 'Pascoa'],
    [addDays(easterDate, 60), 'Corpus Christi'],
    [`${year}-04-21`, 'Tiradentes'],
    [`${year}-05-01`, 'Dia do Trabalhador'],
    [`${year}-09-07`, 'Independencia do Brasil'],
    [`${year}-10-12`, 'Nossa Senhora Aparecida'],
    [`${year}-11-02`, 'Finados'],
    [`${year}-11-15`, 'Proclamacao da Republica'],
    [`${year}-11-20`, 'Consciencia Negra'],
    [`${year}-12-25`, 'Natal'],
  ]

  return holidays.map(([date, title]) => ({
    id: `holiday:${date}:${title}`,
    title,
    description: null,
    event_type: 'feriado',
    starts_on: date,
    starts_at: null,
    ends_on: null,
    ends_at: null,
    layer: 'auto',
    source: 'auto',
  }))
}

function easter(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return toDateKeyFromDate(next)
}

function toDateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
