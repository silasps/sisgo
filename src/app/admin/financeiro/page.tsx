import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'

export default async function AdminFinanceiroPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('organization_id')
    .eq('user_id', user?.id ?? '')
    .eq('active', true)
    .single()

  const orgId = (orgUser as unknown as { organization_id: string } | null)?.organization_id ?? ''

  const { data: lancamentos } = await supabase
    .from('financial_transactions')
    .select('id, description, amount, type, category, date, status')
    .eq('organization_id', orgId)
    .order('date', { ascending: false })
    .limit(50)

  const receitas = lancamentos?.filter(l => l.type === 'income').reduce((s, l) => s + (l.amount ?? 0), 0) ?? 0
  const despesas = lancamentos?.filter(l => l.type === 'expense').reduce((s, l) => s + (l.amount ?? 0), 0) ?? 0
  const saldo = receitas - despesas

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <>
      <Header
        title="Financeiro"
        actions={
          <button className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600">
            + Novo lançamento
          </button>
        }
      />
      <main className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard label="Receitas" value={fmt(receitas)} color="text-green-600" bg="bg-green-50" icon="↑" />
          <SummaryCard label="Despesas" value={fmt(despesas)} color="text-red-500" bg="bg-red-50" icon="↓" />
          <SummaryCard
            label="Saldo"
            value={fmt(saldo)}
            color={saldo >= 0 ? 'text-brand-600' : 'text-red-500'}
            bg="bg-white"
            icon="="
          />
        </div>

        {!lancamentos?.length ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-3xl mb-2">💰</p>
            <p className="text-gray-500 text-sm">Nenhum lançamento cadastrado ainda.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Descrição</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lancamentos.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{l.description}</p>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-500">{l.category ?? '—'}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-gray-500">
                      {l.date ? new Date(l.date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${l.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                      {l.type === 'income' ? '+' : '-'}{fmt(l.amount ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}

function SummaryCard({ label, value, color, bg, icon }: {
  label: string; value: string; color: string; bg: string; icon: string
}) {
  return (
    <div className={`${bg} rounded-xl border border-gray-200 p-5 flex items-center gap-4`}>
      <span className={`text-xl font-bold ${color}`}>{icon}</span>
      <div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid:    { label: 'Pago',     cls: 'bg-green-100 text-green-700' },
    pending: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-700' },
    overdue: { label: 'Atrasado', cls: 'bg-red-100 text-red-600' },
  }
  const s = map[status ?? ''] ?? { label: status ?? '—', cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}
