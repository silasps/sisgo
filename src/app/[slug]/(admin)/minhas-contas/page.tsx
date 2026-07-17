import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

type Props = { params: Promise<{ slug: string }> }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pendente',   cls: 'bg-yellow-100 text-yellow-700' },
  paid:      { label: 'Pago',       cls: 'bg-green-100 text-green-700' },
  overdue:   { label: 'Em atraso',  cls: 'bg-red-100 text-red-700' },
  waived:    { label: 'Dispensado', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelado',  cls: 'bg-gray-100 text-gray-500' },
}

export default async function MinhasContasPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id, name').eq('slug', slug).single()
  if (!org) notFound()
  const orgId = org.id

  // Encontra o person_id do usuário logado via staff_profiles, associado_profiles ou student_profiles
  const [{ data: staffProfile }, { data: associadoProfile }, { data: studentProfile }] = await Promise.all([
    sbAdmin.from('staff_profiles').select('person_id, people(full_name)').eq('user_id', user.id).eq('organization_id', orgId).maybeSingle(),
    sbAdmin.from('associado_profiles').select('person_id, people(full_name)').eq('user_id', user.id).eq('organization_id', orgId).maybeSingle(),
    sbAdmin.from('student_profiles').select('person_id, people(full_name)').eq('user_id', user.id).eq('organization_id', orgId).maybeSingle(),
  ])

  type ProfileRow = { person_id: string; people: { full_name: string } | null } | null
  const profile = (staffProfile as unknown as ProfileRow) ?? (associadoProfile as unknown as ProfileRow) ?? (studentProfile as unknown as ProfileRow)
  const isStudent = !!studentProfile

  if (!profile) {
    return (
      <>
        <Header title="Minhas Contas" />
        <main className="p-6">
          <div className="max-w-lg rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-500 font-medium">Perfil não encontrado</p>
            <p className="text-sm text-gray-400 mt-1">Seu usuário ainda não está vinculado a um perfil de obreiro ou aluno nesta base.</p>
            <Link href={`/${slug}`} className="mt-4 inline-block text-sm text-brand-500 hover:underline">← Voltar</Link>
          </div>
        </main>
      </>
    )
  }

  const personId = profile.person_id
  const personName = profile.people?.full_name ?? 'Você'

  // Pra aluno: turma ativa + plano contratado (regra de cobrança da categoria)
  type EnrollmentRow = {
    status: string
    school_classes: { name: string; starts_at: string | null; ends_at: string | null; schools: { name: string } | null } | null
  }
  type FeeRuleRow = { description: string; amount: number }
  let enrollment: EnrollmentRow | null = null
  let feeRule: FeeRuleRow | null = null
  if (isStudent) {
    const [{ data: enrollmentData }, { data: feeRuleData }] = await Promise.all([
      sbAdmin.from('class_students')
        .select('status, school_classes(name, starts_at, ends_at, schools(name))')
        .eq('person_id', personId).eq('status', 'ativo')
        .order('enrolled_at', { ascending: false }).limit(1).maybeSingle(),
      sbAdmin.from('finance_fee_rules')
        .select('description, amount')
        .eq('organization_id', orgId).eq('person_category', 'aluno').eq('active', true)
        .limit(1).maybeSingle(),
    ])
    enrollment = enrollmentData as unknown as EnrollmentRow | null
    feeRule = feeRuleData as unknown as FeeRuleRow | null
  }

  // Busca cobranças da pessoa
  const { data: chargesData } = await sbAdmin
    .from('finance_charges')
    .select('id, description, amount, due_date, status, reference_month, origin, notes')
    .eq('organization_id', orgId)
    .eq('person_id', personId)
    .order('due_date', { ascending: false })
    .limit(100)

  type ChargeRow = { id: string; description: string; amount: number; due_date: string; status: string; reference_month: string | null; origin: string; notes: string | null }
  const charges = (chargesData ?? []) as ChargeRow[]

  const pending = charges.filter(c => ['pending', 'overdue'].includes(c.status))
  const paid = charges.filter(c => c.status === 'paid')
  const other = charges.filter(c => ['waived', 'cancelled'].includes(c.status))

  const totalPending = pending.reduce((s, c) => s + Number(c.amount), 0)
  const totalOverdue = charges.filter(c => c.status === 'overdue').reduce((s, c) => s + Number(c.amount), 0)
  const totalPaid = paid.reduce((s, c) => s + Number(c.amount), 0)

  return (
    <>
      <Header title="Minhas Contas" />
      <main className="p-4 md:p-6 space-y-5 max-w-2xl">

        {/* Saudação */}
        <div>
          <p className="text-lg font-semibold text-gray-900">{personName}</p>
          <p className="text-sm text-gray-400">{org.name}</p>
        </div>

        {/* Plano da escola (só aluno) */}
        {isStudent && (enrollment?.school_classes || feeRule) && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-2">Escola</h2>
            {enrollment?.school_classes ? (
              <p className="text-sm text-gray-700">
                {enrollment.school_classes.schools?.name ?? 'Escola'} · {enrollment.school_classes.name}
                {enrollment.school_classes.starts_at && enrollment.school_classes.ends_at && (
                  <span className="text-gray-400">
                    {' '}({new Date(`${enrollment.school_classes.starts_at}T00:00:00`).toLocaleDateString('pt-BR')} – {new Date(`${enrollment.school_classes.ends_at}T00:00:00`).toLocaleDateString('pt-BR')})
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-gray-400">Sem turma ativa no momento.</p>
            )}
            {feeRule && (
              <p className="text-sm text-gray-700 mt-2">
                <span className="text-gray-500">Plano contratado:</span> {feeRule.description} — <span className="font-semibold">{fmt(Number(feeRule.amount))}/mês</span>
              </p>
            )}
          </section>
        )}

        {/* KPIs */}
        <section className="grid grid-cols-3 gap-3 animate-stagger">
          <div className={`rounded-xl border p-4 ${totalOverdue > 0 ? 'bg-red-50 border-red-100' : 'bg-yellow-50 border-yellow-100'}`}>
            <p className={`text-xl font-bold ${totalOverdue > 0 ? 'text-red-600' : 'text-yellow-600'}`}>{fmt(totalPending)}</p>
            <p className="text-xs text-gray-600 mt-0.5">Em aberto</p>
            {totalOverdue > 0 && <p className="text-xs text-red-500 font-medium">{fmt(totalOverdue)} em atraso</p>}
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50 p-4">
            <p className="text-xl font-bold text-green-600">{fmt(totalPaid)}</p>
            <p className="text-xs text-gray-600 mt-0.5">Total pago</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-xl font-bold text-gray-900">{charges.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Cobranças no total</p>
          </div>
        </section>

        {/* Em aberto */}
        {pending.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Em aberto</h2>
              <span className="text-xs font-bold text-yellow-600">{fmt(totalPending)}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {pending.map(c => (
                <ChargeItem key={c.id} charge={c} />
              ))}
            </div>
          </section>
        )}

        {/* Pagos */}
        {paid.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Pagos</h2>
              <span className="text-xs font-medium text-green-600">{fmt(totalPaid)}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {paid.map(c => (
                <ChargeItem key={c.id} charge={c} />
              ))}
            </div>
          </section>
        )}

        {/* Outros */}
        {other.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-800">Dispensados / Cancelados</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {other.map(c => (
                <ChargeItem key={c.id} charge={c} />
              ))}
            </div>
          </section>
        )}

        {charges.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-400 text-sm">Nenhuma cobrança registrada para você ainda.</p>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Para dúvidas sobre cobranças, fale com a secretaria da base.
        </p>
      </main>
    </>
  )
}

type ChargeRow = { description: string; amount: number; due_date: string; status: string; reference_month: string | null; notes: string | null }

function ChargeItem({ charge: c }: { charge: ChargeRow }) {
  const status = STATUS_MAP[c.status] ?? { label: c.status, cls: 'bg-gray-100 text-gray-500' }
  const isOverdue = c.status === 'overdue'
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${isOverdue ? 'bg-red-50' : ''}`}>
      <div className="min-w-0">
        <p className={`text-sm font-medium truncate ${isOverdue ? 'text-red-800' : 'text-gray-900'}`}>{c.description}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Vence: {new Date(`${c.due_date}T00:00:00`).toLocaleDateString('pt-BR')}
          {c.reference_month ? ` · Ref: ${c.reference_month}` : ''}
          {c.notes ? ` · ${c.notes}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>{status.label}</span>
        <span className={`text-sm font-bold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>{fmt(Number(c.amount))}</span>
      </div>
    </div>
  )
}
