import Link from 'next/link'
import type { ReactNode } from 'react'
import type { createClient } from '@/lib/supabase/server'
import type { createAdminClient } from '@/lib/supabase/admin'
import {
  getMyMinistries, getMySchools,
  type LinkedMinistry, type LinkedSchool, type UnitAccessContext,
} from '@/lib/auth/unit-access'
import {
  Users, AlertTriangle, Home, BookOpen, ClipboardList, GraduationCap, Megaphone,
} from 'lucide-react'
import { StatCard, SectionCard, EmptyState } from './ui'
import type { AreaTab } from './AreaTabs'
import { MiniCalendar } from './MiniCalendar'
import { PersonalAccountCard } from './PersonalAccountCard'
import { AnnouncementList, type AnnouncementListItem } from '@/components/ui/AnnouncementList'

type ServerClient = Awaited<ReturnType<typeof createClient>>
type AdminClient = ReturnType<typeof createAdminClient>

export type MyAreas = { ministries: LinkedMinistry[]; schools: LinkedSchool[] }

type Announcement = AnnouncementListItem
export type CalendarEventRow = { id: string; title: string; event_type: string; starts_at: string }

/**
 * Ministérios e escolas que o usuário acumula — os mesmos vínculos que
 * liberam a entrada em /ministerios/[id] e /escolas/[id] (lib/auth/unit-access),
 * então toda aba abre sem 404.
 */
export async function getMyAreas(ctx: UnitAccessContext): Promise<MyAreas> {
  const [ministries, schools] = await Promise.all([getMyMinistries(ctx), getMySchools(ctx)])
  return { ministries, schools }
}

/** Uma aba + painel por ministério/escola, com os dados de cada um já carregados. */
export async function buildAreaTabs({ supabase, sbAdmin, slug, orgId, userId, role, areas, laundryEnabled }: {
  supabase: ServerClient; sbAdmin: AdminClient; slug: string; orgId: string; userId: string; role: string; areas: MyAreas
  laundryEnabled: boolean
}): Promise<Array<{ tab: AreaTab; panel: ReactNode }>> {
  if (areas.ministries.length === 0 && areas.schools.length === 0) return []

  const now = new Date().toISOString()
  const todayDate = now.slice(0, 10)

  const [{ data: announcementsRaw }, { count: myReservations }, ministryData, schoolData] = await Promise.all([
    sbAdmin
      .from('base_announcements')
      .select('id, title, body, pinned, category, image_url, image_focal_x, image_focal_y, link_url, link_label, visible_to_roles, publish_at, author_name, created_at')
      .eq('organization_id', orgId)
      .or(`expires_at.is.null,expires_at.gte.${todayDate}`)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),
    areas.ministries.length > 0
      ? supabase.from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('requested_by', userId)
      : Promise.resolve({ count: 0 }),
    Promise.all(areas.ministries.map(async m => {
      // Janela de -1 a +2 meses a partir de hoje — dá pra navegar uns
      // meses na miniatura sem precisar ir ao servidor de novo a cada clique.
      const calStart = new Date(); calStart.setMonth(calStart.getMonth() - 1, 1)
      const calEnd = new Date(); calEnd.setMonth(calEnd.getMonth() + 3, 0)
      const [{ count: pending }, { count: members }, { data: eventsRaw }] = await Promise.all([
        // Pendências só pra quem lidera (mesmo recorte da RLS). Admin porque a
        // RLS exige o papel lider_ministerio, e aqui quem decide é o vínculo.
        m.link === 'lider'
          ? sbAdmin.from('ministry_pending_requests')
            .select('*', { count: 'exact', head: true })
            .eq('ministry_id', m.id)
            .eq('status', 'pendente')
          : Promise.resolve({ count: 0 }),
        supabase.from('ministry_members')
          .select('*', { count: 'exact', head: true })
          .eq('ministry_id', m.id)
          .eq('active', true),
        sbAdmin.from('ministry_calendar_events')
          .select('id, title, event_type, starts_at')
          .eq('ministry_id', m.id)
          .gte('starts_at', calStart.toISOString())
          .lte('starts_at', calEnd.toISOString())
          .order('starts_at', { ascending: true }),
      ])
      return { pending: pending ?? 0, members: members ?? 0, events: (eventsRaw ?? []) as CalendarEventRow[] }
    })),
    Promise.all(areas.schools.map(async s => {
      const [{ count: classes }, { count: interests }, { count: applications }, { data: activeClasses }] = await Promise.all([
        supabase.from('school_classes')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', s.id)
          .gte('ends_at', now),
        sbAdmin.from('school_interest_forms')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('school_id', s.id)
          .not('status', 'in', '("convertido","descartado")'),
        supabase.from('student_applications')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('school_id', s.id)
          .in('status', ['pendente', 'em_analise']),
        supabase.from('school_classes')
          .select('id, name, starts_at, ends_at')
          .eq('school_id', s.id)
          .gte('ends_at', now)
          .order('starts_at', { ascending: true })
          .limit(5),
      ])
      return {
        classes: classes ?? 0,
        interests: interests ?? 0,
        applications: applications ?? 0,
        activeClasses: (activeClasses ?? []) as ClassRow[],
      }
    })),
  ])

  const announcements = ((announcementsRaw ?? []) as Array<Announcement & { visible_to_roles: string[] | null; publish_at: string | null }>)
    .filter(a => (!a.visible_to_roles || a.visible_to_roles.length === 0 || a.visible_to_roles.includes(role))
      && (!a.publish_at || new Date(a.publish_at).getTime() <= Date.now()))
    .slice(0, 3)

  return [
    ...areas.ministries.map((m, i) => {
      const d = ministryData[i]
      return {
        tab: {
          key: `ministerio-${m.id}`,
          label: m.name,
          kind: 'ministerio' as const,
          badge: m.link === 'lider' ? d.pending : undefined,
        },
        panel: (
          <MinistryPanel
            slug={slug}
            orgId={orgId}
            userId={userId}
            laundryEnabled={laundryEnabled}
            ministry={m}
            announcements={announcements}
            pending={d.pending}
            members={d.members}
            events={d.events}
            reservations={myReservations ?? 0}
          />
        ),
      }
    }),
    ...areas.schools.map((s, i) => {
      const d = schoolData[i]
      return {
        tab: { key: `escola-${s.id}`, label: s.name, kind: 'escola' as const, badge: d.applications },
        panel: <SchoolPanel slug={slug} orgId={orgId} userId={userId} laundryEnabled={laundryEnabled} school={s} announcements={announcements} {...d} />,
      }
    }),
  ]
}

// ── Painéis ─────────────────────────────────────────────────

function AreaHero({ kicker, title, announcements }: { kicker: string; title: string; announcements: Announcement[] }) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white p-4 md:p-5">
      <p className="text-xs uppercase tracking-wide text-white/70">{kicker}</p>
      <p className="text-lg font-bold leading-tight">{title}</p>
      {announcements.length > 0 ? (
        <AnnouncementList announcements={announcements} variant="hero" />
      ) : (
        <p className="text-xs text-white/70 mt-2 flex items-center gap-1">
          <Megaphone size={12} /> Nenhum anúncio da Comunicação no momento.
        </p>
      )}
    </div>
  )
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="group bg-white rounded-xl border border-gray-200 p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
      <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </Link>
  )
}

function MinistryPanel({ slug, orgId, userId, laundryEnabled, ministry, announcements, pending, members, events, reservations }: {
  slug: string; orgId: string; userId: string; laundryEnabled: boolean
  ministry: LinkedMinistry; announcements: Announcement[]
  pending: number; members: number; events: CalendarEventRow[]; reservations: number
}) {
  const base = `/${slug}/ministerios/${ministry.id}`
  const isLeader = ministry.link === 'lider'
  return (
    <>
      <AreaHero
        kicker={`Ministério · ${isLeader ? 'Líder' : 'Membro'}`}
        title={ministry.longName || ministry.name}
        announcements={announcements}
      />
      <div className={`grid grid-cols-2 gap-3 animate-stagger ${isLeader ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <StatCard label="Membros" value={members} icon={Users} href={`${base}/equipe`} color="teal" />
        {isLeader && <StatCard label="Pendências" value={pending} icon={AlertTriangle} href={`${base}/equipe`} color="pink" />}
        <StatCard label="Reservas" value={reservations} icon={Home} href={`/${slug}/reservas`} color="orange" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <QuickLink href={base} title="Geral" description="Visão geral do ministério" />
        <QuickLink href={`${base}/equipe`} title="Equipe" description="Membros e solicitações" />
      </div>
      <PersonalAccountCard slug={slug} orgId={orgId} userId={userId} laundryEnabled={laundryEnabled} />
      <MiniCalendar slug={slug} events={events} />
    </>
  )
}

type ClassRow = { id: string; name: string; starts_at: string | null; ends_at: string | null }

function SchoolPanel({ slug, orgId, userId, laundryEnabled, school, announcements, classes, interests, applications, activeClasses }: {
  slug: string; orgId: string; userId: string; laundryEnabled: boolean
  school: LinkedSchool; announcements: Announcement[]
  classes: number; interests: number; applications: number; activeClasses: ClassRow[]
}) {
  const base = `/${slug}/escolas/${school.id}`
  const monthYear = (d: string) => new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  return (
    <>
      <AreaHero
        kicker={`Escola · ${school.link === 'lider' ? 'Líder' : 'Obreiro'}`}
        title={school.name}
        announcements={announcements}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-stagger">
        <StatCard label="Turmas ativas" value={classes} icon={BookOpen} href={base} color="orange" />
        <StatCard label="Pré-inscrições" value={interests} icon={ClipboardList} href={`/${slug}/inscricoes`} color="blue" />
        <StatCard label="Inscrições em análise" value={applications} icon={GraduationCap} href={`/${slug}/inscricoes`} color="purple" />
      </div>
      <PersonalAccountCard slug={slug} orgId={orgId} userId={userId} laundryEnabled={laundryEnabled} />
      <SectionCard title="Turmas ativas" href={base} linkLabel="Abrir escola">
        {activeClasses.length === 0 ? (
          <EmptyState icon={BookOpen} label="Nenhuma turma ativa nesta escola" />
        ) : (
          <div className="divide-y divide-gray-100">
            {activeClasses.map(c => (
              <Link key={c.id} href={`${base}/turmas/${c.id}`}
                className="flex items-start justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-brand-50 transition-colors group">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 group-hover:text-brand-700 transition-colors truncate">{c.name}</p>
                  {c.starts_at && c.ends_at && (
                    <p className="text-xs text-gray-400 mt-0.5">{monthYear(c.starts_at)} – {monthYear(c.ends_at)}</p>
                  )}
                </div>
                <span className="ml-2 shrink-0 text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium">
                  ativa
                </span>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  )
}
