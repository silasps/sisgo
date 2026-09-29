import Link from 'next/link'
import type { ReactNode } from 'react'
import type { createClient } from '@/lib/supabase/server'
import type { createAdminClient } from '@/lib/supabase/admin'
import {
  getMyMinistries, getMySchools,
  type LinkedMinistry, type LinkedSchool, type UnitAccessContext,
} from '@/lib/auth/unit-access'
import {
  Users, AlertTriangle, Home, BookOpen, ClipboardList, GraduationCap,
} from 'lucide-react'
import { StatCard, SectionCard, EmptyState } from './ui'
import type { AreaTab } from './AreaTabs'
import { MiniCalendar } from './MiniCalendar'
import { PersonalAccountCard } from './PersonalAccountCard'

type ServerClient = Awaited<ReturnType<typeof createClient>>
type AdminClient = ReturnType<typeof createAdminClient>

export type MyAreas = { ministries: LinkedMinistry[]; schools: LinkedSchool[] }

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

/**
 * Uma aba + faixa (hero) + painel por ministério/escola, com os dados de
 * cada um já carregados. A faixa vem separada do painel pra poder subir
 * pro topo da Início (antes dos anúncios), acompanhando a aba ativa.
 */
export async function buildAreaTabs({ supabase, sbAdmin, slug, orgId, userId, areas, laundryEnabled }: {
  supabase: ServerClient; sbAdmin: AdminClient; slug: string; orgId: string; userId: string; areas: MyAreas
  laundryEnabled: boolean
}): Promise<Array<{ tab: AreaTab; hero: ReactNode; panel: ReactNode }>> {
  if (areas.ministries.length === 0 && areas.schools.length === 0) return []

  const now = new Date().toISOString()

  const [{ data: ministryHeroRows }, { data: schoolHeroRows }, { count: myReservations }, ministryData, schoolData] = await Promise.all([
    // Foto própria do ministério/escola (mesma usada na página pública,
    // hero_image_url) — cada área com a sua, em vez de repetir o mesmo
    // anúncio geral da organização em todo painel (isso já aparece uma vez
    // só, no topo da Início).
    areas.ministries.length > 0
      ? sbAdmin.from('ministries').select('id, hero_image_url').in('id', areas.ministries.map(m => m.id))
      : Promise.resolve({ data: [] as Array<{ id: string; hero_image_url: string | null }> }),
    areas.schools.length > 0
      ? sbAdmin.from('schools').select('id, hero_image_url').in('id', areas.schools.map(s => s.id))
      : Promise.resolve({ data: [] as Array<{ id: string; hero_image_url: string | null }> }),
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

  const heroByMinistry = new Map((ministryHeroRows ?? []).map(r => [r.id, r.hero_image_url]))
  const heroBySchool = new Map((schoolHeroRows ?? []).map(r => [r.id, r.hero_image_url]))

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
        hero: (
          <AreaHero
            key={`ministerio-hero-${m.id}`}
            kicker={`Ministério · ${m.link === 'lider' ? 'Líder' : 'Membro'}`}
            title={m.longName || m.name}
            heroImageUrl={heroByMinistry.get(m.id) ?? null}
          />
        ),
        panel: (
          <MinistryPanel
            key={`ministerio-${m.id}`}
            slug={slug}
            orgId={orgId}
            userId={userId}
            laundryEnabled={laundryEnabled}
            ministry={m}
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
        hero: (
          <AreaHero
            key={`escola-hero-${s.id}`}
            kicker={`Escola · ${s.link === 'lider' ? 'Líder' : 'Obreiro'}`}
            title={s.name}
            heroImageUrl={heroBySchool.get(s.id) ?? null}
          />
        ),
        panel: <SchoolPanel key={`escola-${s.id}`} slug={slug} orgId={orgId} userId={userId} laundryEnabled={laundryEnabled} school={s} {...d} />,
      }
    }),
  ]
}

// ── Painéis ─────────────────────────────────────────────────

// Foto própria da área (hero_image_url, a mesma da página pública) — cada
// ministério/escola com a sua, em vez de repetir o anúncio geral da
// organização (esse já aparece uma vez só, no topo da Início).
function AreaHero({ kicker, title, heroImageUrl }: { kicker: string; title: string; heroImageUrl: string | null }) {
  if (!heroImageUrl) {
    return (
      <div className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white p-4 md:p-5">
        <p className="text-xs uppercase tracking-wide text-white/70">{kicker}</p>
        <p className="text-lg font-bold leading-tight">{title}</p>
      </div>
    )
  }
  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-gray-900" style={{ aspectRatio: '16 / 9', maxHeight: 280 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem pública do bucket, não passa pelo otimizador */}
      <img src={heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <p className="text-[10px] uppercase tracking-wide text-white/85">{kicker}</p>
        <p className="text-base sm:text-lg font-bold text-white leading-tight">{title}</p>
      </div>
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

function MinistryPanel({ slug, orgId, userId, laundryEnabled, ministry, pending, members, events, reservations }: {
  slug: string; orgId: string; userId: string; laundryEnabled: boolean
  ministry: LinkedMinistry
  pending: number; members: number; events: CalendarEventRow[]; reservations: number
}) {
  const base = `/${slug}/ministerios/${ministry.id}`
  const isLeader = ministry.link === 'lider'
  return (
    <>
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

function SchoolPanel({ slug, orgId, userId, laundryEnabled, school, classes, interests, applications, activeClasses }: {
  slug: string; orgId: string; userId: string; laundryEnabled: boolean
  school: LinkedSchool
  classes: number; interests: number; applications: number; activeClasses: ClassRow[]
}) {
  const base = `/${slug}/escolas/${school.id}`
  const monthYear = (d: string) => new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  return (
    <>
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
