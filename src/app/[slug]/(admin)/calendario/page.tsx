import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { getStudentSchoolIds } from '@/lib/school-scope'
import { notFound, redirect } from 'next/navigation'
import {
  CalendarWorkspace,
  type CalendarEvent,
  type SchoolOption,
  type MinistryOption,
} from './CalendarWorkspace'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ ano?: string }>
}

const CALENDAR_TIME_ZONE = 'America/Sao_Paulo'

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
  const canManageMinistry = role === 'lider_ministerio'
  const isObreiroMinisterio = role === 'obreiro_ministerio'
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

  const leaderMinistryIds = canManageMinistry
    ? preview?.ministryId
      ? [preview.ministryId]
      : ((await admin.from('ministry_leaders').select('ministry_id').eq('organization_id', orgId).eq('user_id', userId)).data ?? []).map(row => row.ministry_id as string)
    : []
  const obreiroMinistryIds = isObreiroMinisterio
    ? preview?.ministryId
      ? [preview.ministryId]
      : await getObreiroMinistryIds(admin, orgId, userId)
    : []
  const scopedMinistryIds = canManageMinistry ? leaderMinistryIds : isObreiroMinisterio ? obreiroMinistryIds : []
  const shouldScopeMinistries = canManageMinistry || isObreiroMinisterio

  // Aluno só vê o que é da própria escola + notas pessoais + eventos de base
  // cuja audiência inclua "aluno" (ou seja "todos") — nada de ministério.
  const isAluno = role === 'aluno'

  // Ministério de Comunicação (ministries.linked_role = 'comunicacao'): além de
  // admin_base/lider_base/superadmin, quem lidera ou participa desse ministério
  // também pode criar anúncios e eventos de base.
  const myMinistryIdsForComms = role === 'lider_ministerio' ? leaderMinistryIds : role === 'obreiro_ministerio' ? obreiroMinistryIds : []
  const comunicacaoMinistryIds = myMinistryIdsForComms.length > 0
    ? ((await admin.from('ministries').select('id').eq('organization_id', orgId).eq('linked_role', 'comunicacao')).data ?? []).map(row => row.id as string)
    : []
  const isComunicacaoMember = myMinistryIdsForComms.some(id => comunicacaoMinistryIds.includes(id))

  const start = `${year}-01-01`
  const end = `${year}-12-31`
  const startAt = localDateTimeToIso(`${start}T00:00`)
  const endAt = localDateTimeToIso(`${end}T23:59:59`)

  let baseEventsQuery = admin
    .from('base_calendar_events')
    .select('id, title, description, event_type, starts_on, ends_on, created_by, visible_to_roles')
    .eq('organization_id', orgId)
    .gte('starts_on', start)
    .lte('starts_on', end)
    .order('starts_on', { ascending: true })

  if (isAluno) {
    baseEventsQuery = baseEventsQuery.or('visible_to_roles.is.null,visible_to_roles.cs.{aluno}')
  }

  let schoolEventsQuery = admin
    .from('school_calendar_events')
    .select('id, title, description, event_type, starts_at, ends_at, school_id, visible_to_students, schools(name)')
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

  let ministryEventsQuery = admin
    .from('ministry_calendar_events')
    .select('id, title, description, event_type, starts_at, ends_at, ministry_id, ministries(name)')
    .eq('organization_id', orgId)
    .gte('starts_at', startAt)
    .lte('starts_at', endAt)
    .order('starts_at', { ascending: true })

  if (shouldScopeMinistries) {
    const mIds = scopedMinistryIds.length > 0 ? scopedMinistryIds : ['no-match']
    ministryEventsQuery = ministryEventsQuery.in('ministry_id', mIds)
  }
  if (isAluno) {
    ministryEventsQuery = ministryEventsQuery.in('ministry_id', ['no-match'])
  }

  const [{ data: baseRows }, { data: schoolRows }, { data: ministryRows }, { data: noteRows }, { data: classRows }, { data: schoolOptionsRows }, { data: ministryOptionsRows }] = await Promise.all([
    baseEventsQuery,
    schoolEventsQuery,
    ministryEventsQuery,
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
    canManageBase
      ? admin.from('ministries').select('id, name').eq('organization_id', orgId).eq('active', true).order('name')
      : leaderMinistryIds.length > 0
        ? admin.from('ministries').select('id, name').eq('organization_id', orgId).in('id', leaderMinistryIds).order('name')
        : Promise.resolve({ data: [] as MinistryOption[] }),
  ])

  const baseEvents: CalendarEvent[] = ((baseRows ?? []) as Array<{
    id: string
    title: string
    description: string | null
    event_type: 'evento' | 'feriado' | 'trimestre' | 'escola' | 'outro'
    starts_on: string
    ends_on: string | null
    created_by: string | null
    visible_to_roles: string[] | null
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
    visible_to_students: boolean
    schools: { name: string } | null
  }>).map(event => ({
    id: event.id,
    title: event.title,
    description: event.description,
    event_type: event.event_type,
    starts_on: isoToCalendarDateKey(event.starts_at),
    starts_at: event.starts_at,
    ends_on: event.ends_at ? isoToCalendarDateKey(event.ends_at) : null,
    ends_at: event.ends_at,
    visible_to_students: event.visible_to_students,
    layer: 'escola',
    source: 'manual',
    school_id: event.school_id,
    school_name: event.schools?.name ?? null,
  }))

  const ministryEvents: CalendarEvent[] = ((ministryRows ?? []) as unknown as Array<{
    id: string
    title: string
    description: string | null
    event_type: 'reuniao' | 'devocional' | 'evento' | 'outro'
    starts_at: string
    ends_at: string | null
    ministry_id: string
    ministries: { name: string } | null
  }>).map(event => ({
    id: event.id,
    title: event.title,
    description: event.description,
    event_type: event.event_type,
    starts_on: isoToCalendarDateKey(event.starts_at),
    starts_at: event.starts_at,
    ends_on: event.ends_at ? isoToCalendarDateKey(event.ends_at) : null,
    ends_at: event.ends_at,
    layer: 'ministerio',
    source: 'manual',
    ministry_id: event.ministry_id,
    ministry_name: event.ministries?.name ?? null,
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
    starts_on: isoToCalendarDateKey(note.starts_at),
    starts_at: note.starts_at,
    ends_on: note.ends_at ? isoToCalendarDateKey(note.ends_at) : null,
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

  const events = [
    ...baseEvents, ...schoolEvents, ...ministryEvents, ...personalNotes, ...classEvents,
    ...(isAluno ? [] : holidayEvents(year)),
  ].sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.title.localeCompare(b.title))

  const schoolOptions = (schoolOptionsRows ?? []) as SchoolOption[]
  const ministryOptions = (ministryOptionsRows ?? []) as MinistryOption[]

  async function createBaseEvent(formData: FormData) {
    'use server'
    if (!canManageBase && !isComunicacaoMember) return
    const db = createAdminClient()
    const title = (formData.get('title') as string).trim()
    const startsOn = formData.get('starts_on') as string
    const eventType = formData.get('event_type') as string
    const visibleToRoles = formData.getAll('visible_to_roles') as string[]
    if (!title || !startsOn) return

    await db.from('base_calendar_events').insert({
      organization_id: orgId,
      title,
      description: ((formData.get('description') as string | null)?.trim() || null),
      event_type: eventType || 'evento',
      starts_on: startsOn,
      ends_on: (formData.get('ends_on') as string) || null,
      visible_to_roles: visibleToRoles.length > 0 ? visibleToRoles : null,
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
      visible_to_students: formData.get('visible_to_students') === 'on',
      created_by: userId,
    })
    redirect(`/${slug}/calendario?ano=${year}`)
  }

  async function createMinistryEvent(formData: FormData) {
    'use server'
    if (!canManageBase && !canManageMinistry) return
    const db = createAdminClient()
    const title = (formData.get('title') as string).trim()
    const ministryId = formData.get('ministry_id') as string
    const startsAt = formData.get('starts_at') as string
    const endsAt = formData.get('ends_at') as string
    const allowedMinistryIds = canManageBase ? null : leaderMinistryIds
    if (!title || !ministryId || !startsAt) return
    if (allowedMinistryIds && !allowedMinistryIds.includes(ministryId)) return

    await db.from('ministry_calendar_events').insert({
      organization_id: orgId,
      ministry_id: ministryId,
      title,
      description: ((formData.get('description') as string | null)?.trim() || null),
      event_type: (formData.get('event_type') as string) || 'reuniao',
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

    if (layer === 'base' && (canManageBase || isComunicacaoMember)) {
      let query = db.from('base_calendar_events').delete().eq('organization_id', orgId).eq('id', eventId)
      if (!canManageBase) query = query.eq('created_by', userId)
      await query
    }

    if (layer === 'escola' && (canManageBase || canManageSchool)) {
      let query = db.from('school_calendar_events').delete().eq('organization_id', orgId).eq('id', eventId)
      if (!canManageBase) query = query.in('school_id', leaderSchoolIds.length > 0 ? leaderSchoolIds : ['no-match'])
      await query
    }

    if (layer === 'ministerio' && (canManageBase || canManageMinistry)) {
      let query = db.from('ministry_calendar_events').delete().eq('organization_id', orgId).eq('id', eventId)
      if (!canManageBase) query = query.in('ministry_id', leaderMinistryIds.length > 0 ? leaderMinistryIds : ['no-match'])
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

    if (layer === 'base' && (canManageBase || isComunicacaoMember)) {
      const startsOn = formData.get('starts_on') as string
      const visibleToRoles = formData.getAll('visible_to_roles') as string[]
      if (!startsOn) return

      let query = db
        .from('base_calendar_events')
        .update({
          title,
          description: ((formData.get('description') as string | null)?.trim() || null),
          event_type: (formData.get('event_type') as string) || 'evento',
          starts_on: startsOn,
          ends_on: (formData.get('ends_on') as string) || null,
          visible_to_roles: visibleToRoles.length > 0 ? visibleToRoles : null,
        })
        .eq('organization_id', orgId)
        .eq('id', eventId)
      if (!canManageBase) query = query.eq('created_by', userId)
      await query
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
          visible_to_students: formData.get('visible_to_students') === 'on',
        })
        .eq('organization_id', orgId)
        .eq('id', eventId)
      if (!canManageBase) query = query.in('school_id', leaderSchoolIds.length > 0 ? leaderSchoolIds : ['no-match'])
      await query
    }

    if (layer === 'ministerio' && (canManageBase || canManageMinistry)) {
      const ministryId = formData.get('ministry_id') as string
      const startsAt = formData.get('starts_at') as string
      const endsAt = formData.get('ends_at') as string
      const allowedMinistryIds = canManageBase ? null : leaderMinistryIds
      if (!ministryId || !startsAt) return
      if (allowedMinistryIds && !allowedMinistryIds.includes(ministryId)) return

      let query = db
        .from('ministry_calendar_events')
        .update({
          ministry_id: ministryId,
          title,
          description: ((formData.get('description') as string | null)?.trim() || null),
          event_type: (formData.get('event_type') as string) || 'reuniao',
          starts_at: localDateTimeToIso(startsAt),
          ends_at: endsAt ? localDateTimeToIso(endsAt) : null,
        })
        .eq('organization_id', orgId)
        .eq('id', eventId)
      if (!canManageBase) query = query.in('ministry_id', leaderMinistryIds.length > 0 ? leaderMinistryIds : ['no-match'])
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
      <Header title="Calendário" />
      <CalendarWorkspace
        year={year}
        slug={slug}
        events={events}
        schoolOptions={schoolOptions}
        ministryOptions={ministryOptions}
        permissions={{ canManageBase, canManageSchool, canManageMinistry, canAddPrivateNote, canManageComunicacao: isComunicacaoMember, currentUserId: userId }}
        actions={{ createBaseEvent, createSchoolEvent, createMinistryEvent, createPersonalNote, updateEvent, deleteEvent }}
      />
    </>
  )
}

function sortKey(event: CalendarEvent) {
  return event.starts_at ?? `${event.starts_on}T00:00:00`
}

async function getObreiroMinistryIds(
  db: ReturnType<typeof createAdminClient>,
  organizationId: string,
  userId: string,
) {
  const { data: staffProfile } = await db
    .from('staff_profiles')
    .select('person_id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single()

  if (!staffProfile?.person_id) return []

  const { data: memberships } = await db
    .from('ministry_members')
    .select('ministry_id')
    .eq('person_id', staffProfile.person_id)
    .eq('active', true)

  return (memberships ?? []).map(row => row.ministry_id as string)
}

function localDateTimeToIso(value: string) {
  return zonedLocalDateTimeToDate(value, CALENDAR_TIME_ZONE).toISOString()
}

function zonedLocalDateTimeToDate(value: string, timeZone: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return new Date(value)

  const [, year, month, day, hour, minute, second = '0'] = match
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  let utcMs = localAsUtc - getTimeZoneOffsetMs(new Date(localAsUtc), timeZone)
  utcMs = localAsUtc - getTimeZoneOffsetMs(new Date(utcMs), timeZone)
  return new Date(utcMs)
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )
  return zonedAsUtc - date.getTime()
}

function isoToCalendarDateKey(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
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
