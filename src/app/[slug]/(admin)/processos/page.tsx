import Link from 'next/link'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { Workflow } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { ScrollHighlight } from '@/components/ui/ScrollHighlight'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { isManagementRole, isOperationalManager } from '@/lib/auth/permissions'
import { getOpenProcesses, getRecentlyClosedProcesses, type MoveType, type ProcessItem } from '@/lib/processes'
import type { UnitRef } from '@/lib/staff-loans'
import { getPeopleFinanceSummaries, type PersonFinanceSummary } from '@/lib/finance/personFinanceStatus'
import { notifyFinancePendency } from '@/lib/finance/notifyFinancePendency'
import { PersonFinanceBadge } from '@/components/finance/PersonFinanceBadge'
import { ProcessMoveTypeTag, ProcessStatusBadge } from '@/components/processos/ProcessosCard'
import { ProcessDecisionForm } from '@/components/processos/ProcessDecisionForm'
import { confirmTransferAsDH } from '../ministerios/[id]/actions'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ msg?: string; erro?: string }>
}

const fmtDate = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('pt-BR')
const daysAgo = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)

// O que falta acontecer, em linguagem de gente — muda conforme de quem é a vez.
// Em qualquer caso quem fecha é o DH; o líder só dá a posição dele.
function nextStepText(item: ProcessItem): string {
  if (item.kind === 'emprestimo') {
    if (item.status === 'aceito_origem') return `O líder de ${item.from.name} aceitou. Falta o OK final do DH.`
    if (item.status === 'recusado_origem') return `O líder de ${item.from.name} recusou. A decisão final é do DH.`
    return `Aguardando o líder de ${item.from.name} responder. Depois o DH dá o OK final — ou decide antes, se precisar.`
  }
  if (item.status === 'aceito_destino') return `O líder de ${item.to.name} aceitou. Falta o OK final do DH.`
  if (item.status === 'rejeitado_destino') return `O líder de ${item.to.name} recusou. A decisão final é do DH.`
  return `Aguardando o líder de ${item.to.name} responder. Depois o DH dá o OK final — ou decide antes, se precisar.`
}

function periodText(item: ProcessItem): string | null {
  if (item.moveType !== 'acumulo' || !item.startsOn) return null
  return item.endsOn
    ? `Período: ${fmtDate(item.startsOn)} a ${fmtDate(item.endsOn)}`
    : `A partir de ${fmtDate(item.startsOn)} · sem prazo`
}

// Mesmo aviso de pendência financeira da confirmação de transferência: e-mail
// pra pessoa e/ou pro líder do destino, se marcado no modal do "Dar OK final".
async function notifyFinanceAfterMove(orgId: string, kind: string, id: string, notifyCandidate: boolean, notifyLeader: boolean) {
  if (!notifyCandidate && !notifyLeader) return
  const sb = createAdminClient()
  let personId: string | null = null
  let dest: UnitRef | null = null
  if (kind === 'emprestimo') {
    const { data } = await sb.from('staff_loans').select('person_id, to_unit_type, to_school_id, to_ministry_id').eq('id', id).single()
    if (data) {
      personId = data.person_id
      dest = data.to_unit_type === 'school' ? { type: 'school', id: data.to_school_id } : { type: 'ministry', id: data.to_ministry_id }
    }
  } else {
    const { data } = await sb.from('ministry_transfers').select('person_id, to_ministry_id').eq('id', id).single()
    if (data) {
      personId = data.person_id
      dest = { type: 'ministry', id: data.to_ministry_id }
    }
  }
  if (!personId || !dest) return

  const { data: person } = await sb.from('people').select('full_name').eq('id', personId).single()
  let leaderEmail: string | null = null
  if (notifyLeader) {
    const { data: leader } = dest.type === 'school'
      ? await sb.from('school_leaders').select('user_id').eq('school_id', dest.id).limit(1).maybeSingle()
      : await sb.from('ministry_leaders').select('user_id').eq('ministry_id', dest.id).limit(1).maybeSingle()
    if (leader?.user_id) {
      const { data: leaderUser } = await sb.auth.admin.getUserById(leader.user_id)
      leaderEmail = leaderUser.user?.email ?? null
    }
  }
  await notifyFinancePendency({
    organizationId: orgId,
    personId,
    personName: person?.full_name ?? 'Pessoa',
    notifyCandidate,
    notifyLeaderEmail: leaderEmail,
  })
}

function ProcessCard({ item, finance, decideAction, roleOptions, todayStr }: {
  item: ProcessItem
  finance: PersonFinanceSummary
  decideAction: ((formData: FormData) => Promise<void>) | null
  roleOptions: Array<{ id: string; name: string }>
  todayStr: string
}) {
  const dias = daysAgo(item.createdAt)
  const period = periodText(item)
  // Transferência não guarda função: o padrão é "Membro", como sempre foi.
  const defaultRoleId = item.toRoleId ?? (item.kind === 'transferencia' ? roleOptions.find(r => r.name === 'Membro')?.id ?? null : null)
  return (
    <li id={`item-${item.id}`} className="scroll-mt-20 rounded-xl border border-purple-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ProcessMoveTypeTag moveType={item.moveType} />
        <ProcessStatusBadge item={item} />
        <span className="ml-auto text-[11px] text-gray-400">{dias === 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`}</span>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-gray-900">{item.personName}</p>
          <PersonFinanceBadge summary={finance} />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          <Link href={item.from.href} className="font-medium text-purple-700 hover:underline">{item.from.name}</Link>
          <span className="mx-1.5 text-gray-400">→</span>
          <Link href={item.to.href} className="font-medium text-purple-700 hover:underline">{item.to.name}</Link>
          {item.role && <span className="text-gray-500"> · como {item.role}</span>}
        </p>
        {period && <p className="text-xs text-gray-500 mt-0.5">{period}</p>}
        <p className="text-xs text-gray-400 mt-0.5">Pedido por {item.requesterName} em {fmtDate(item.createdAt)}</p>
      </div>

      {(item.reason || item.leaderNotes) && (
        <div className="space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {item.reason && <p><span className="font-medium text-gray-700">Motivo do pedido:</span> {item.reason}</p>}
          {item.leaderNotes && (
            <p><span className="font-medium text-gray-700">{item.kind === 'emprestimo' ? 'Líder atual' : 'Líder de destino'}:</span> {item.leaderNotes}</p>
          )}
        </div>
      )}

      <p className={`text-xs ${item.stage === 'dh' ? 'font-medium text-purple-800' : 'text-purple-700/80'}`}>{nextStepText(item)}</p>

      {decideAction && (
        <ProcessDecisionForm
          action={decideAction}
          kind={item.kind}
          processId={item.id}
          personName={item.personName}
          fromName={item.from.name}
          toName={item.to.name}
          toUnitType={item.toUnit.type}
          defaultMoveType={item.moveType}
          roleOptions={roleOptions}
          defaultRoleId={defaultRoleId}
          defaultRoleText={item.toUnit.type === 'school' ? item.role : null}
          showPeriod={item.kind === 'emprestimo'}
          defaultStartsOn={item.startsOn}
          defaultEndsOn={item.endsOn}
          todayStr={todayStr}
          financeSummary={finance}
          rejectLabel={item.kind === 'emprestimo' ? 'Encerrar pedido' : 'Recusar'}
        />
      )}
    </li>
  )
}

export default async function ProcessosPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { msg, erro } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()
  const orgId = org.id

  const { role } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  if (!isManagementRole(role)) redirect(`/${slug}/dashboard`)
  // lider_base acompanha, mas quem dá o OK final é DH/admin (OPERATIONAL_ROLES).
  const canDecide = isOperationalManager(role)

  const [open, closed] = await Promise.all([
    getOpenProcesses(orgId, slug),
    getRecentlyClosedProcesses(orgId, slug),
  ])

  // Funções dos ministérios de destino, pro "Função em ..." do card de configuração.
  const destMinistryIds = [...new Set(open.filter(p => p.toUnit.type === 'ministry').map(p => p.toUnit.id))]
  const [financeByPerson, { data: rolesData }] = await Promise.all([
    getPeopleFinanceSummaries(orgId, [...new Set(open.map(p => p.personId))]),
    canDecide && destMinistryIds.length > 0
      ? createAdminClient().from('ministry_roles').select('id, name, ministry_id').in('ministry_id', destMinistryIds).order('name')
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; ministry_id: string }> }),
  ])
  const rolesByMinistry = new Map<string, Array<{ id: string; name: string }>>()
  for (const r of rolesData ?? []) {
    rolesByMinistry.set(r.ministry_id, [...(rolesByMinistry.get(r.ministry_id) ?? []), { id: r.id, name: r.name }])
  }

  const handleDecide = async (formData: FormData) => {
    'use server'
    if (!canDecide) return
    const kind = formData.get('kind') as string
    const processId = formData.get('process_id') as string
    const approve = formData.get('decision') === 'efetivar'
    const notes = (formData.get('notes') as string)?.trim() || null
    const moveType: MoveType = formData.get('move_type') === 'transferencia' ? 'transferencia' : 'acumulo'
    const ministryRoleId = (formData.get('role_id') as string) || null
    try {
      if (kind === 'emprestimo') {
        const { decideStaffLoanAsDH } = await import('@/lib/staff-loans')
        await decideStaffLoanAsDH(processId, user.id, approve, notes, {
          moveType,
          ministryRoleId,
          role: (formData.get('role') as string) || null,
          startsOn: (formData.get('starts_on') as string) || null,
          endsOn: (formData.get('ends_on') as string) || null,
        })
      } else {
        await confirmTransferAsDH(processId, user.id, approve, notes, { moveType, ministryRoleId })
      }
    } catch (e) {
      redirect(`/${slug}/processos?erro=${encodeURIComponent(e instanceof Error ? e.message : 'Não foi possível concluir.')}`)
    }
    if (approve) {
      await notifyFinanceAfterMove(orgId, kind, processId, formData.get('notify_candidate') === 'on', formData.get('notify_leader') === 'on')
    }
    redirect(`/${slug}/processos?msg=${approve ? (moveType === 'transferencia' ? 'transferido' : 'acumulo') : 'encerrado'}`)
  }

  const awaitingDh = open.filter(p => p.stage === 'dh')
  const awaitingLeader = open.filter(p => p.stage !== 'dh')
  const todayStr = new Date().toISOString().slice(0, 10)

  const msgs: Record<string, { text: string; cls: string }> = {
    acumulo: { text: 'OK dado — a pessoa continua onde estava e já aparece também na equipe de destino.', cls: 'bg-green-50 border-green-200 text-green-700' },
    transferido: { text: 'OK dado — a pessoa foi transferida e já aparece na equipe de destino.', cls: 'bg-green-50 border-green-200 text-green-700' },
    encerrado: { text: 'Processo encerrado.', cls: 'bg-gray-50 border-gray-200 text-gray-700' },
  }
  const msgInfo = msg ? msgs[msg] : null

  const renderList = (items: ProcessItem[]) => (
    <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
      {items.map(item => (
        <ProcessCard
          key={`${item.kind}-${item.id}`}
          item={item}
          finance={financeByPerson.get(item.personId) ?? { personId: item.personId, pendingCount: 0, overdueCount: 0, pendingAmount: 0, overdueAmount: 0 }}
          decideAction={canDecide ? handleDecide : null}
          roleOptions={item.toUnit.type === 'ministry' ? (rolesByMinistry.get(item.toUnit.id) ?? []) : []}
          todayStr={todayStr}
        />
      ))}
    </ul>
  )

  return (
    <>
      <Header title="Processos" />
      <Suspense><ScrollHighlight /></Suspense>
      <main className="p-4 md:p-6 space-y-5 max-w-5xl w-full mx-auto overflow-y-auto flex-1">
        {msgInfo && <div className={`border rounded-lg px-4 py-3 text-sm ${msgInfo.cls}`}>{msgInfo.text}</div>}
        {erro && <div className="border rounded-lg px-4 py-3 text-sm bg-red-50 border-red-200 text-red-700">{erro}</div>}

        <section className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white">
              <Workflow size={20} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-purple-950">Processos em andamento</h2>
              <p className="text-xs text-purple-900/70 mt-0.5">
                Pedidos e transferências de obreiros entre ministérios e escolas da base. O líder envolvido aceita ou
                recusa, mas quem dá o OK final é sempre o DH — escolhendo se a pessoa acumula funções ou é transferida.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: 'Em andamento', value: open.length, cls: 'bg-white text-purple-900 border border-purple-100' },
              { label: 'Com o DH', value: awaitingDh.length, cls: 'bg-purple-600 text-white' },
              { label: 'Com líderes', value: awaitingLeader.length, cls: 'bg-white text-purple-900 border border-purple-100' },
            ].map(s => (
              <div key={s.label} className={`rounded-lg px-3 py-2 ${s.cls}`}>
                <p className="text-xl font-bold leading-none">{s.value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide leading-tight opacity-80 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          {!canDecide && (
            <p className="text-xs text-purple-900/70 mt-3">Você acompanha os processos; o OK final é do DH ou do admin da base.</p>
          )}
        </section>

        {open.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-purple-200 p-10 text-center">
            <p className="text-3xl mb-3">✓</p>
            <p className="text-gray-400 text-sm">Nenhum processo em andamento no momento.</p>
          </div>
        )}

        {awaitingDh.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-purple-900">
              Aguardando o OK do DH
              <span className="ml-2 text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded-full">{awaitingDh.length}</span>
            </h3>
            {renderList(awaitingDh)}
          </section>
        )}

        {awaitingLeader.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-purple-900">
              Aguardando resposta de líder
              <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{awaitingLeader.length}</span>
            </h3>
            {renderList(awaitingLeader)}
          </section>
        )}

        {closed.length > 0 && (
          <details className="rounded-xl border border-gray-200 bg-white">
            <summary className="px-4 py-3 text-sm font-semibold text-gray-700 cursor-pointer select-none">
              Concluídos nos últimos 30 dias ({closed.length})
            </summary>
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {closed.map(item => (
                <li key={`${item.kind}-${item.id}`} className="px-4 py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.personName}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.from.name} → {item.to.name} · {item.moveType === 'transferencia' ? 'Transferência' : 'Acúmulo'} · {fmtDate(item.updatedAt)}
                    </p>
                    {item.dhNotes && <p className="text-xs text-gray-400 italic truncate">DH: &ldquo;{item.dhNotes}&rdquo;</p>}
                  </div>
                  <ProcessStatusBadge item={item} className="mt-0.5" />
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </>
  )
}
