import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { isManagementRole } from '@/lib/auth/permissions'
import {
  CalendarWorkspace,
  type CalendarEvent,
  type MinistryOption,
} from '../../../calendario/CalendarWorkspace'

type Props = {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ ano?: string }>
}

const CALENDAR_TIME_ZONE = 'America/Sao_Paulo'

export default async function MinisterioCalendarioPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { ano } = await searchParams
  const year = Number(ano) || new Date().getFullYear()
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()
  const orgId = org.id
  const userId = user.id

  const { role } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const canManageBase = role === 'superadmin' || role === 'admin_base' || role === 'lider_base'
  const canManageMinistry = role === 'lider_ministerio' || canManageBase

  const { data: ministry } = await supabase
    .from('ministries')
    .select('id, name')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!ministry) notFound()

  const start = `${year}-01-01`
  const end = `${year}-12-31`
  const startAt = localDateTimeToIso(`${start}T00:00`)
  const endAt = localDateTimeToIso(`${end}T23:59:59`)

  const [{ data: baseRows }, { data: ministryRows }, { data: noteRows }] = await Promise.all([
    admin.from('base_calendar_events')
      .select('id, title, description, event_type, starts_on, ends_on')
      .eq('organization_id', orgId)
      .gte('starts_on', start).lte('starts_on', end)
      .order('starts_on', { ascending: true }),
    admin.from('ministry_calendar_events')
      .select('id, title, description, event_type, starts_at, ends_at, ministry_id, ministries(name)')
      .eq('organization_id', orgId)
      .eq('ministry_id', id)
      .gte('starts_at', startAt).lte('starts_at', endAt)
      .order('starts_at', { ascending: true }),
    admin.from('personal_calendar_notes')
      .select('id, title, notes, starts_at, ends_at')
      .eq('organization_id', orgId).eq('user_id', userId)
      .gte('starts_at', startAt).lte('starts_at', endAt)
      .order('starts_at', { ascending: true }),
  ])

  const baseEvents: CalendarEvent[] = ((baseRows ?? []) as Array<{
    id: string; title: string; description: string | null
    event_type: 'evento' | 'feriado' | 'trimestre' | 'escola' | 'outro'
    starts_on: string; ends_on: string | null
  }>).map(e => ({ ...e, starts_at: null, ends_at: null, layer: 'base', source: 'manual' }))

  const ministryEvents: CalendarEvent[] = ((ministryRows ?? []) as unknown as Array<{
    id: string; title: string; description: string | null
    event_type: 'reuniao' | 'devocional' | 'evento' | 'outro'
    starts_at: string; ends_at: string | null
    ministry_id: string; ministries: { name: string } | null
  }>).map(e => ({
    id: e.id, title: e.title, description: e.description,
    event_type: e.event_type,
    starts_on: isoToCalendarDateKey(e.starts_at),
    starts_at: e.starts_at,
    ends_on: e.ends_at ? isoToCalendarDateKey(e.ends_at) : null,
    ends_at: e.ends_at,
    layer: 'ministerio', source: 'manual',
    ministry_id: e.ministry_id,
    ministry_name: e.ministries?.name ?? null,
  }))

  const personalNotes: CalendarEvent[] = ((noteRows ?? []) as Array<{
    id: string; title: string; notes: string | null; starts_at: string; ends_at: string | null
  }>).map(n => ({
    id: n.id, title: n.title, description: n.notes,
    event_type: 'nota',
    starts_on: isoToCalendarDateKey(n.starts_at),
    starts_at: n.starts_at,
    ends_on: n.ends_at ? isoToCalendarDateKey(n.ends_at) : null,
    ends_at: n.ends_at,
    layer: 'pessoal', source: 'manual',
  }))

  const events = [...baseEvents, ...ministryEvents, ...personalNotes, ...holidayEvents(year)]
    .sort((a, b) => (a.starts_at ?? `${a.starts_on}T00:00:00`).localeCompare(b.starts_at ?? `${b.starts_on}T00:00:00`) || a.title.localeCompare(b.title))

  const ministryOptions: MinistryOption[] = [{ id: ministry.id, name: ministry.name }]
  const redirectUrl = `/${slug}/ministerios/${id}/calendario?ano=${year}`

  async function createMinistryEvent(formData: FormData) {
    'use server'
    if (!canManageMinistry) return
    const db = createAdminClient()
    const title = (formData.get('title') as string).trim()
    const startsAt = formData.get('starts_at') as string
    const endsAt = formData.get('ends_at') as string
    if (!title || !startsAt) return

    await db.from('ministry_calendar_events').insert({
      organization_id: orgId,
      ministry_id: id,
      title,
      description: ((formData.get('description') as string | null)?.trim() || null),
      event_type: (formData.get('event_type') as string) || 'reuniao',
      starts_at: localDateTimeToIso(startsAt),
      ends_at: endsAt ? localDateTimeToIso(endsAt) : null,
      created_by: userId,
    })
    redirect(redirectUrl)
  }

  async function createPersonalNote(formData: FormData) {
    'use server'
    const db = createAdminClient()
    const title = (formData.get('title') as string).trim()
    const startsAt = formData.get('starts_at') as string
    const endsAt = formData.get('ends_at') as string
    if (!title || !startsAt) return

    await db.from('personal_calendar_notes').insert({
      organization_id: orgId, user_id: userId, title,
      notes: ((formData.get('notes') as string | null)?.trim() || null),
      starts_at: localDateTimeToIso(startsAt),
      ends_at: endsAt ? localDateTimeToIso(endsAt) : null,
    })
    redirect(redirectUrl)
  }

  async function deleteEvent(formData: FormData) {
    'use server'
    const db = createAdminClient()
    const eventId = formData.get('event_id') as string
    const layer = formData.get('layer') as string

    if (layer === 'base' && canManageBase) {
      await db.from('base_calendar_events').delete().eq('organization_id', orgId).eq('id', eventId)
    }
    if (layer === 'ministerio' && canManageMinistry) {
      await db.from('ministry_calendar_events').delete().eq('organization_id', orgId).eq('ministry_id', id).eq('id', eventId)
    }
    if (layer === 'pessoal') {
      await db.from('personal_calendar_notes').delete().eq('organization_id', orgId).eq('user_id', userId).eq('id', eventId)
    }
    redirect(redirectUrl)
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
      await db.from('base_calendar_events').update({
        title, description: ((formData.get('description') as string | null)?.trim() || null),
        event_type: (formData.get('event_type') as string) || 'evento',
        starts_on: startsOn, ends_on: (formData.get('ends_on') as string) || null,
      }).eq('organization_id', orgId).eq('id', eventId)
    }

    if (layer === 'ministerio' && canManageMinistry) {
      const startsAt = formData.get('starts_at') as string
      const endsAt = formData.get('ends_at') as string
      if (!startsAt) return
      await db.from('ministry_calendar_events').update({
        title, description: ((formData.get('description') as string | null)?.trim() || null),
        event_type: (formData.get('event_type') as string) || 'reuniao',
        starts_at: localDateTimeToIso(startsAt),
        ends_at: endsAt ? localDateTimeToIso(endsAt) : null,
      }).eq('organization_id', orgId).eq('ministry_id', id).eq('id', eventId)
    }

    if (layer === 'pessoal') {
      const startsAt = formData.get('starts_at') as string
      const endsAt = formData.get('ends_at') as string
      if (!startsAt) return
      await db.from('personal_calendar_notes').update({
        title, notes: ((formData.get('notes') as string | null)?.trim() || null),
        starts_at: localDateTimeToIso(startsAt),
        ends_at: endsAt ? localDateTimeToIso(endsAt) : null,
      }).eq('organization_id', orgId).eq('user_id', userId).eq('id', eventId)
    }

    redirect(redirectUrl)
  }

  const noopAction = async () => { 'use server' }

  return (
    <CalendarWorkspace
      year={year}
      slug={slug}
      events={events}
      schoolOptions={[]}
      ministryOptions={ministryOptions}
      permissions={{ canManageBase, canManageSchool: false, canManageMinistry, canAddPrivateNote: true }}
      actions={{ createBaseEvent: noopAction, createSchoolEvent: noopAction, createMinistryEvent, createPersonalNote, updateEvent, deleteEvent }}
    />
  )
}

function localDateTimeToIso(value: string) {
  return zonedLocalDateTimeToDate(value, CALENDAR_TIME_ZONE).toISOString()
}

function zonedLocalDateTimeToDate(value: string, timeZone: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return new Date(value)
  const [, y, mo, d, h, mi, s = '0'] = match
  const localAsUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  let utcMs = localAsUtc - getTimeZoneOffsetMs(new Date(localAsUtc), timeZone)
  utcMs = localAsUtc - getTimeZoneOffsetMs(new Date(utcMs), timeZone)
  return new Date(utcMs)
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]))
  return Date.UTC(Number(v.year), Number(v.month) - 1, Number(v.day), Number(v.hour), Number(v.minute), Number(v.second)) - date.getTime()
}

function isoToCalendarDateKey(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value))
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]))
  return `${v.year}-${v.month}-${v.day}`
}

function holidayEvents(year: number): CalendarEvent[] {
  const e = easter(year)
  const holidays: Array<[string, string]> = [
    [`${year}-01-01`, 'Confraternização Universal'],
    [addDays(e, -48), 'Carnaval'], [addDays(e, -47), 'Carnaval'],
    [addDays(e, -2), 'Sexta-feira Santa'],
    [toDateKey(e), 'Páscoa'], [addDays(e, 60), 'Corpus Christi'],
    [`${year}-04-21`, 'Tiradentes'], [`${year}-05-01`, 'Dia do Trabalhador'],
    [`${year}-09-07`, 'Independência'], [`${year}-10-12`, 'N. Sra. Aparecida'],
    [`${year}-11-02`, 'Finados'], [`${year}-11-15`, 'Proclamação da República'],
    [`${year}-11-20`, 'Consciência Negra'], [`${year}-12-25`, 'Natal'],
  ]
  return holidays.map(([date, title]) => ({
    id: `holiday:${date}:${title}`, title, description: null,
    event_type: 'feriado', starts_on: date, starts_at: null,
    ends_on: null, ends_at: null, layer: 'auto', source: 'auto',
  }))
}

function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function addDays(date: Date, days: number) {
  const n = new Date(date); n.setDate(n.getDate() + days); return toDateKey(n)
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
