import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type Props = {
  searchParams: Promise<{ tab?: string; org?: string }>
}

const STATUS_LABEL: Record<string, string> = {
  pendente:           'Pendente',
  formulario_enviado: 'Form. enviado',
  em_contato:         'Em contato',
  em_analise:         'Em análise',
  convertido:         'Convertido',
  aprovado:           'Aprovado',
  reprovado:          'Reprovado',
  descartado:         'Descartado',
  cancelado:          'Cancelado',
}
const STATUS_COLOR: Record<string, string> = {
  pendente:           'bg-yellow-100 text-yellow-700',
  formulario_enviado: 'bg-blue-100 text-blue-700',
  em_contato:         'bg-purple-100 text-purple-700',
  em_analise:         'bg-blue-100 text-blue-700',
  convertido:         'bg-green-100 text-green-700',
  aprovado:           'bg-green-100 text-green-700',
  reprovado:          'bg-red-100 text-red-700',
  descartado:         'bg-gray-100 text-gray-500',
  cancelado:          'bg-gray-100 text-gray-500',
}

const ACTIVE_STATUSES = ['pendente', 'formulario_enviado', 'em_contato', 'em_analise']
const FINAL_STATUSES = ['convertido', 'aprovado', 'reprovado', 'descartado', 'cancelado']

function daysAgo(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

export default async function SuperAdminInscricoesPage({ searchParams }: Props) {
  const { tab = 'pre', org: orgFilter } = await searchParams
  const db = createAdminClient()

  // ── Server actions ─────────────────────────────────────────────────────────

  async function discardInterest(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const id = formData.get('id') as string
    await adm().from('school_interest_forms')
      .update({ status: 'descartado', responded_at: new Date().toISOString() })
      .eq('id', id)
    redirect('/superadmin/inscricoes?tab=pre')
  }

  async function discardStaff(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const id = formData.get('id') as string
    await adm().from('staff_applications')
      .update({ status: 'cancelado', reviewed_at: new Date().toISOString() })
      .eq('id', id)
    redirect('/superadmin/inscricoes?tab=obreiros')
  }

  // ── Data fetching ───────────────────────────────────────────────────────────

  const { data: orgs } = await db
    .from('organizations')
    .select('id, name, slug')
    .eq('active', true)
    .order('name')

  const orgMap = new Map((orgs ?? []).map(o => [o.id, o]))

  // Pre-inscricoes (school_interest_forms)
  let preQuery = db
    .from('school_interest_forms')
    .select('id, full_name, email, status, created_at, organization_id, school_id, schools(name)')
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false })

  if (orgFilter) preQuery = preQuery.eq('organization_id', orgFilter)

  const { data: preRaw } = await preQuery

  // Staff applications (obreiros)
  let staffQuery = db
    .from('staff_applications')
    .select('id, status, applied_at, organization_id, notes, people(id, full_name), ministries(name)')
    .in('status', ACTIVE_STATUSES)
    .order('applied_at', { ascending: false })

  if (orgFilter) staffQuery = staffQuery.eq('organization_id', orgFilter)

  const { data: staffRaw } = await staffQuery

  type PersonRef = { id: string; full_name: string } | null
  type MinistryRef = { name: string } | null
  type SchoolRef = { name: string } | null

  const staffList = (staffRaw ?? []) as unknown as Array<{
    id: string; status: string; applied_at: string; organization_id: string; notes: string | null;
    people: PersonRef; ministries: MinistryRef
  }>

  const preList = (preRaw ?? []) as unknown as Array<{
    id: string; full_name: string; email: string; status: string; created_at: string;
    organization_id: string; school_id: string; schools: SchoolRef
  }>

  // Get person emails for staff
  const personIds = staffList.map(r => r.people?.id).filter(Boolean) as string[]
  const emailMap = new Map<string, string>()
  if (personIds.length > 0) {
    const { data: contacts } = await db.from('person_contacts')
      .select('person_id, value')
      .in('person_id', personIds)
      .eq('type', 'email')
      .eq('is_primary', true)
    for (const c of (contacts ?? []) as Array<{ person_id: string; value: string }>) {
      emailMap.set(c.person_id, c.value)
    }
  }

  const preCount = preList.length
  const staffCount = staffList.length

  const TABS = [
    { key: 'pre',      label: `Pré-inscrições (${preCount})` },
    { key: 'obreiros', label: `Candidatos a Obreiro (${staffCount})` },
  ]

  return (
    <>
      <Header title="Inscrições Soltas" />
      <main className="p-4 md:p-6 space-y-6">

        {/* Filtro por base */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-600">Filtrar por base:</span>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/superadmin/inscricoes?tab=${tab}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                !orgFilter ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
              }`}
            >
              Todas
            </Link>
            {(orgs ?? []).map(org => (
              <Link
                key={org.id}
                href={`/superadmin/inscricoes?tab=${tab}&org=${org.id}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  orgFilter === org.id ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
                }`}
              >
                {org.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-1">
            {TABS.map(t => (
              <Link
                key={t.key}
                href={`/superadmin/inscricoes?tab=${t.key}${orgFilter ? `&org=${orgFilter}` : ''}`}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Pre-inscricoes */}
        {tab === 'pre' && (
          <section className="space-y-3">
            {preList.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-gray-400 text-sm">Nenhuma pré-inscrição pendente.</p>
              </div>
            ) : preList.map(row => {
              const org = orgMap.get(row.organization_id)
              const dias = daysAgo(row.created_at)
              return (
                <div key={row.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{row.full_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[row.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        dias === 0 ? 'bg-green-100 text-green-700'
                        : dias <= 2 ? 'bg-yellow-100 text-yellow-700'
                        : dias <= 4 ? 'bg-orange-100 text-orange-700'
                        : 'bg-red-100 text-red-700'
                      }`}>{dias === 0 ? 'Hoje' : `${dias}d`}</span>
                    </div>
                    <p className="text-xs text-gray-500">{row.email}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                      {org && (
                        <span className="inline-flex items-center gap-1">
                          🏛 <Link href={`/${org.slug}/inscricoes`} className="text-brand-500 hover:underline">{org.name}</Link>
                        </span>
                      )}
                      {row.schools?.name && <span>📚 {row.schools.name}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {org && (
                      <Link
                        href={`/${org.slug}/inscricoes?tab=pre_inscricao`}
                        className="px-3 py-1.5 text-xs font-semibold bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-lg transition-colors"
                      >
                        Ver na base →
                      </Link>
                    )}
                    <form action={discardInterest}>
                      <input type="hidden" name="id" value={row.id} />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                      >
                        Descartar
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* Obreiros */}
        {tab === 'obreiros' && (
          <section className="space-y-3">
            {staffList.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-gray-400 text-sm">Nenhum candidato a obreiro pendente.</p>
              </div>
            ) : staffList.map(row => {
              const org = orgMap.get(row.organization_id)
              const pessoa = row.people
              const ministry = row.ministries
              const personEmail = pessoa ? emailMap.get(pessoa.id) : undefined
              const dias = daysAgo(row.applied_at)
              return (
                <div key={row.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{pessoa?.full_name ?? '—'}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[row.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        dias === 0 ? 'bg-green-100 text-green-700'
                        : dias <= 2 ? 'bg-yellow-100 text-yellow-700'
                        : dias <= 4 ? 'bg-orange-100 text-orange-700'
                        : 'bg-red-100 text-red-700'
                      }`}>{dias === 0 ? 'Hoje' : `${dias}d`}</span>
                    </div>
                    {personEmail && <p className="text-xs text-gray-500">{personEmail}</p>}
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                      {org && (
                        <span className="inline-flex items-center gap-1">
                          🏛 <Link href={`/${org.slug}/inscricoes`} className="text-brand-500 hover:underline">{org.name}</Link>
                        </span>
                      )}
                      {ministry?.name && <span>⛪ {ministry.name}</span>}
                    </div>
                    {row.notes && <p className="text-xs text-gray-400 italic">"{row.notes}"</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {org && (
                      <Link
                        href={`/${org.slug}/inscricoes?tab=obreiro`}
                        className="px-3 py-1.5 text-xs font-semibold bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-lg transition-colors"
                      >
                        Ver na base →
                      </Link>
                    )}
                    <form action={discardStaff}>
                      <input type="hidden" name="id" value={row.id} />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </section>
        )}

      </main>
    </>
  )
}
