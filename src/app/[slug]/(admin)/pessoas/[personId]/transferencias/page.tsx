import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { MANAGEMENT_ROLES } from '@/lib/auth/permissions'
import { getProcessesForPerson, type ProcessItem } from '@/lib/processes'
import { ProcessMoveTypeTag, ProcessStatusBadge, processPeriodText } from '@/components/processos/ProcessosCard'

type Props = { params: Promise<{ slug: string; personId: string }> }

const fmtDate = (v: string) => new Date(v).toLocaleDateString('pt-BR')

// Toda movimentação da pessoa entre escolas/ministérios: pedidos de obreiro
// (staff_loans) e transferências pedidas pelo líder atual (ministry_transfers)
// — ver lib/processes.ts.
function MoveItem({ item }: { item: ProcessItem }) {
  const period = processPeriodText(item)
  const done = item.status === 'aprovado' || item.status === 'efetivado'
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-900">
          {item.from.name} <span className="text-gray-400">→</span> {item.to.name}
        </p>
        <ProcessStatusBadge item={item} className="shrink-0" />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <ProcessMoveTypeTag moveType={item.moveType} />
        <span className="text-xs text-gray-400">
          {item.kind === 'emprestimo' ? 'Pedido' : 'Enviado'} por {item.requesterName} em {fmtDate(item.createdAt)}
        </span>
      </div>
      {period && <p className="text-xs text-gray-500 mt-1">Período: {period}</p>}
      {item.role && <p className="text-xs text-gray-500 mt-1">Função no destino: {item.role}</p>}
      {item.reason && <p className="text-sm text-gray-600 mt-2">{item.reason}</p>}
      {item.leaderNotes && (
        <p className="text-xs text-gray-500 mt-2">
          <span className="font-medium text-gray-600">{item.kind === 'emprestimo' ? 'Nota do líder atual' : 'Nota do líder de destino'}:</span> {item.leaderNotes}
        </p>
      )}
      {item.dhNotes && (
        <p className="text-xs text-gray-500 mt-1"><span className="font-medium text-gray-600">Nota do DH:</span> {item.dhNotes}</p>
      )}
      {done && <p className="text-xs text-green-600 mt-1">Efetivado em {fmtDate(item.updatedAt)}</p>}
    </div>
  )
}

export default async function PessoaTransferenciasPage({ params }: Props) {
  const { slug, personId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!MANAGEMENT_ROLES.includes(role as never)) redirect(`/${slug}/pessoas/${personId}/carteirinha`)

  const db = createAdminClient()
  const { data: person } = await db.from('people').select('id').eq('id', personId).eq('organization_id', org.id).single()
  if (!person) notFound()

  const moves = await getProcessesForPerson(org.id, slug, personId)

  return (
    <main className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Movimentações entre ministérios e escolas</h2>
          <p className="text-xs text-gray-400 mt-0.5">Pedidos e transferências, com o tipo (acúmulo de funções ou transferência) e o OK final do DH.</p>
        </div>
        {moves.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {moves.map(m => <MoveItem key={`${m.kind}-${m.id}`} item={m} />)}
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">Nenhuma movimentação registrada para esta pessoa.</p>
          </div>
        )}
      </section>
    </main>
  )
}
