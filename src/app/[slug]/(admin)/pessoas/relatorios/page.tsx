import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { MANAGEMENT_ROLES } from '@/lib/auth/permissions'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

type Props = { params: Promise<{ slug: string }> }

const GENDER_LABELS: Record<string, string> = { M: 'Homens', F: 'Mulheres', outro: 'Outro' }

function StatCard({ value, label, tone = 'gray', href }: { value: number; label: string; tone?: 'gray' | 'green' | 'amber'; href?: string }) {
  const toneCls = tone === 'green' ? 'text-green-600' : tone === 'amber' ? 'text-amber-600' : 'text-gray-900'
  const content = (
    <>
      <p className={`text-2xl font-bold ${toneCls}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </>
  )
  const cls = 'rounded-xl border border-gray-100 bg-white p-4'
  if (!href) return <div className={cls}>{content}</div>
  return (
    <Link href={href} className={`${cls} block transition-colors hover:border-brand-200 hover:bg-brand-50/40`}>
      {content}
    </Link>
  )
}

function BarRow({ label, count, max, href }: { label: string; count: number; max: number; href?: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0
  const content = (
    <>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-500 font-medium">{count}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-brand-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </>
  )
  if (!href) return <div className="px-4 py-2">{content}</div>
  return (
    <Link href={href} className="block px-4 py-2 transition-colors hover:bg-gray-50">
      {content}
    </Link>
  )
}

export default async function RelatoriosPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id, name').eq('slug', slug).single()
  if (!org) notFound()

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!MANAGEMENT_ROLES.includes(role as never)) redirect(`/${slug}/pessoas`)

  const db = createAdminClient()

  const [
    { count: totalPessoas },
    { count: obreirosAtivos },
    { count: obreirosInativos },
    { count: alunosAtivos },
    { count: associados },
    { data: genderRows },
    { data: staffPeopleRows },
    { data: ministryLinksRows },
    { count: acessosPendentes },
    { count: obreirosSemEmail },
    { count: emergenciasAtivas },
  ] = await Promise.all([
    db.from('people').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
    db.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('active', true),
    db.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('active', false),
    db.from('student_profiles').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('active', true),
    db.from('associado_profiles').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('active', true),
    db.from('people').select('gender').eq('organization_id', org.id),
    db.from('staff_profiles').select('person_id').eq('organization_id', org.id).eq('active', true),
    db.from('ministry_members').select('person_id, ministries(name)').eq('active', true),
    db.from('organization_users').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('active', true).is('invite_sent_at', null),
    db.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('active', true).is('user_id', null),
    db.from('person_emergency_access').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).is('revoked_at', null).gt('expires_at', new Date().toISOString()),
  ])

  const genderCounts = { M: 0, F: 0, outro: 0, none: 0 }
  for (const p of genderRows ?? []) {
    const g = p.gender as string | null
    if (g === 'M' || g === 'F' || g === 'outro') genderCounts[g]++
    else genderCounts.none++
  }

  const activeStaffPersonIds = new Set((staffPeopleRows ?? []).map(s => s.person_id as string))
  type MinistryLinkRaw = { person_id: string; ministries: { name: string } | null }
  const ministryCounts = new Map<string, number>()
  const peopleWithMinistry = new Set<string>()
  for (const link of ((ministryLinksRows ?? []) as unknown) as MinistryLinkRaw[]) {
    if (!link.ministries || !activeStaffPersonIds.has(link.person_id)) continue
    peopleWithMinistry.add(link.person_id)
    ministryCounts.set(link.ministries.name, (ministryCounts.get(link.ministries.name) ?? 0) + 1)
  }
  const semMinisterio = [...activeStaffPersonIds].filter(id => !peopleWithMinistry.has(id)).length
  const ministryList = [...ministryCounts.entries()].sort((a, b) => b[1] - a[1])
  const maxMinistryCount = ministryList.length ? ministryList[0][1] : 0

  return (
    <>
      <Header title="Relatórios" backHref={`/${slug}/pessoas`} />
      <main className="p-4 md:p-6 space-y-5">
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard value={totalPessoas ?? 0} label="Total de pessoas" href={`/${slug}/pessoas?tab=todos`} />
          <StatCard value={obreirosAtivos ?? 0} label="Obreiros ativos" tone="green" href={`/${slug}/pessoas?tab=obreiros&status=ativo`} />
          <StatCard value={alunosAtivos ?? 0} label="Alunos ativos" href={`/${slug}/pessoas?tab=alunos&status=ativo`} />
          <StatCard value={associados ?? 0} label="Associados ativos" href={`/${slug}/pessoas?tab=associados`} />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Por gênero</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <BarRow label={GENDER_LABELS.M} count={genderCounts.M} max={totalPessoas ?? 0} href={`/${slug}/pessoas?tab=todos&genero=M`} />
            <BarRow label={GENDER_LABELS.F} count={genderCounts.F} max={totalPessoas ?? 0} href={`/${slug}/pessoas?tab=todos&genero=F`} />
            {genderCounts.outro > 0 && <BarRow label={GENDER_LABELS.outro} count={genderCounts.outro} max={totalPessoas ?? 0} href={`/${slug}/pessoas?tab=todos&genero=outro`} />}
            <BarRow label="Não informado" count={genderCounts.none} max={totalPessoas ?? 0} href={`/${slug}/pessoas?tab=todos&genero=none`} />
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Obreiros ativos por ministério</h2>
            <span className="text-xs text-gray-400">{ministryList.length} ministério{ministryList.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {ministryList.map(([name, count]) => (
              <BarRow key={name} label={name} count={count} max={maxMinistryCount} href={`/${slug}/pessoas?tab=obreiros&status=ativo&ministerio=${encodeURIComponent(name)}`} />
            ))}
            {semMinisterio > 0 && (
              <BarRow label="Sem ministério vinculado" count={semMinisterio} max={maxMinistryCount} href={`/${slug}/pessoas?tab=obreiros&status=ativo&ministerio=__none__`} />
            )}
            {ministryList.length === 0 && semMinisterio === 0 && (
              <p className="text-sm text-gray-400 p-4">Nenhum obreiro ativo ainda.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Acesso</h2>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard value={obreirosInativos ?? 0} label="Obreiros inativos/desligados" href={`/${slug}/pessoas?tab=obreiros&status=inativo`} />
            <StatCard value={obreirosSemEmail ?? 0} label="Obreiros sem email (sem login ainda)" tone="amber" href={`/${slug}/pessoas?tab=obreiros&status=ativo&semEmail=true`} />
            <StatCard value={acessosPendentes ?? 0} label="Logins aguardando envio de credenciais" tone="amber" href={`/${slug}/pessoas/importar`} />
            <StatCard value={emergenciasAtivas ?? 0} label="Acessos de emergência ativos" tone="amber" href={`/${slug}/pessoas/emergencia`} />
          </div>
        </section>
      </main>
    </>
  )
}
