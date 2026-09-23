import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { MANAGEMENT_ROLES } from '@/lib/auth/permissions'

type Props = { params: Promise<{ slug: string; personId: string }> }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pendente_destino: { label: 'Aguardando destino', cls: 'bg-yellow-100 text-yellow-700' },
  aceito_destino: { label: 'Aceito pelo destino, aguardando DH', cls: 'bg-blue-100 text-blue-700' },
  rejeitado_destino: { label: 'Rejeitado pelo destino', cls: 'bg-red-100 text-red-700' },
  efetivado: { label: 'Efetivado', cls: 'bg-green-100 text-green-700' },
  rejeitado_dh: { label: 'Rejeitado pelo DH', cls: 'bg-red-100 text-red-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
}

type TransferRow = {
  id: string
  reason: string | null
  status: string
  dest_notes: string | null
  dest_reviewed_at: string | null
  dh_notes: string | null
  dh_reviewed_at: string | null
  effective_date: string | null
  created_at: string
  from_ministry: { name: string } | null
  to_ministry: { name: string } | null
}

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—')

function TransferItem({ t }: { t: TransferRow }) {
  const status = STATUS_MAP[t.status] ?? { label: t.status, cls: 'bg-gray-100 text-gray-500' }
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-900">
          {t.from_ministry?.name ?? '—'} <span className="text-gray-400">→</span> {t.to_ministry?.name ?? '—'}
        </p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${status.cls}`}>{status.label}</span>
      </div>
      <p className="text-xs text-gray-400 mt-0.5">Solicitado em {fmtDate(t.created_at)}</p>
      {t.reason && <p className="text-sm text-gray-600 mt-2">{t.reason}</p>}
      {t.dest_notes && (
        <p className="text-xs text-gray-500 mt-2">
          <span className="font-medium text-gray-600">Nota do líder de destino</span>
          {t.dest_reviewed_at ? ` (${fmtDate(t.dest_reviewed_at)})` : ''}: {t.dest_notes}
        </p>
      )}
      {t.dh_notes && (
        <p className="text-xs text-gray-500 mt-1">
          <span className="font-medium text-gray-600">Nota do DH</span>
          {t.dh_reviewed_at ? ` (${fmtDate(t.dh_reviewed_at)})` : ''}: {t.dh_notes}
        </p>
      )}
      {t.effective_date && <p className="text-xs text-green-600 mt-1">Efetivado em {fmtDate(t.effective_date)}</p>}
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

  const { data: transfersData } = await db
    .from('ministry_transfers')
    .select('id, reason, status, dest_notes, dest_reviewed_at, dh_notes, dh_reviewed_at, effective_date, created_at, from_ministry:ministries!ministry_transfers_from_ministry_id_fkey(name), to_ministry:ministries!ministry_transfers_to_ministry_id_fkey(name)')
    .eq('organization_id', org.id)
    .eq('person_id', personId)
    .order('created_at', { ascending: false })

  const transfers = ((transfersData ?? []) as unknown) as TransferRow[]

  return (
    <main className="p-4 md:p-6 space-y-5 max-w-2xl">
      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Histórico de transferências entre ministérios</h2>
        </div>
        {transfers.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {transfers.map(t => <TransferItem key={t.id} t={t} />)}
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">Nenhuma transferência registrada para esta pessoa.</p>
          </div>
        )}
      </section>
    </main>
  )
}
