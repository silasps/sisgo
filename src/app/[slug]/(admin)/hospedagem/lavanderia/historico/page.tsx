import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound } from 'next/navigation'
import { getRolePreview } from '@/lib/role-preview'
import { isManagementRole, canSeeHospedagem } from '@/lib/auth/permissions'
import { WashingMachine, ArrowLeft, Timer, DollarSign } from 'lucide-react'
import Link from 'next/link'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string; machine?: string; status?: string }>
}

export default async function HistoricoPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { page: pageStr, machine: machineFilter, status: statusFilter } = await searchParams

  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  const realRole = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''
  const preview  = await getRolePreview(realRole)
  const role     = preview?.role ?? realRole

  if (!isManagementRole(role) && !canSeeHospedagem(role)) notFound()

  // ── Data ────────────────────────────────────────────────────────────────────
  const pageSize = 30
  const currentPage = Math.max(1, parseInt(pageStr ?? '1'))
  const offset = (currentPage - 1) * pageSize

  const { data: machines } = await sbAdmin.from('laundry_machines')
    .select('id, name')
    .eq('organization_id', org.id)
    .order('name')

  const machinesList = (machines ?? []) as Array<{ id: string; name: string }>
  const machineNameMap = new Map(machinesList.map(m => [m.id, m.name]))

  let query = sbAdmin.from('laundry_sessions')
    .select('*', { count: 'exact' })
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (machineFilter) query = query.eq('machine_id', machineFilter)
  if (statusFilter) query = query.eq('status', statusFilter)

  const { data: sessions, count } = await query

  type SessionRow = {
    id: string; machine_id: string; guest_name: string | null
    duration_minutes: number; amount_paid: number; payment_method: string
    payment_status: string; status: string; started_at: string | null
    expected_end_at: string | null; created_at: string
  }

  const sessionsList = (sessions ?? []) as SessionRow[]
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  const formatCents = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const statusLabel: Record<string, string> = {
    pending_payment: 'Aguardando',
    running: 'Em uso',
    completed: 'Concluída',
    cancelled: 'Cancelada',
  }

  const statusColor: Record<string, string> = {
    pending_payment: 'text-yellow-600 bg-yellow-50',
    running: 'text-blue-600 bg-blue-50',
    completed: 'text-green-600 bg-green-50',
    cancelled: 'text-red-500 bg-red-50',
  }

  const paymentLabel: Record<string, string> = {
    pix: 'PIX', credit: 'Crédito', debit: 'Débito',
    cash: 'Dinheiro', balance: 'Saldo', free: 'Cortesia',
  }

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const vals = { page: pageStr, machine: machineFilter, status: statusFilter, ...overrides }
    for (const [k, v] of Object.entries(vals)) {
      if (v && v !== '1') p.set(k, v)
    }
    const qs = p.toString()
    return `/${slug}/hospedagem/lavanderia/historico${qs ? `?${qs}` : ''}`
  }

  // ── Total do período filtrado ───────────────────────────────────────────────
  const totalRevenue = sessionsList
    .filter(s => s.status !== 'cancelled')
    .reduce((sum, s) => sum + s.amount_paid, 0)

  return (
    <>
      <Header title="Histórico de Lavanderia" />
      <main className="p-4 md:p-6 space-y-5 max-w-6xl">
        <Link
          href={`/${slug}/hospedagem/lavanderia`}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={12} />
          Voltar ao painel
        </Link>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Máquina:</label>
            <select
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
              defaultValue={machineFilter ?? ''}
              onChange={undefined}
            >
              <option value="">Todas</option>
              {machinesList.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Status:</label>
            <div className="flex gap-1">
              {[
                { key: '', label: 'Todos' },
                { key: 'completed', label: 'Concluídas' },
                { key: 'running', label: 'Em uso' },
                { key: 'cancelled', label: 'Canceladas' },
              ].map(f => (
                <Link
                  key={f.key}
                  href={buildUrl({ status: f.key || undefined, page: undefined })}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    (statusFilter ?? '') === f.key
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>
          {totalRevenue > 0 && (
            <div className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-600">
              <DollarSign size={12} />
              Total: {formatCents(totalRevenue)}
            </div>
          )}
        </div>

        {/* Session list */}
        {sessionsList.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            Nenhuma sessão encontrada.
          </div>
        ) : (
          <div className="space-y-2">
            {sessionsList.map(session => (
              <div
                key={session.id}
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <WashingMachine size={14} className="text-gray-300 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {machineNameMap.get(session.machine_id) ?? 'Máquina'}
                      {session.guest_name && (
                        <span className="text-gray-400 font-normal"> · {session.guest_name}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span>{new Date(session.created_at).toLocaleDateString('pt-BR')}</span>
                      {session.started_at && (
                        <span>{new Date(session.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <Timer size={9} />
                        {session.duration_minutes} min
                      </span>
                      <span>{paymentLabel[session.payment_method] ?? session.payment_method}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">
                    {formatCents(session.amount_paid)}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor[session.status] ?? ''}`}>
                    {statusLabel[session.status] ?? session.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            {currentPage > 1 && (
              <Link
                href={buildUrl({ page: String(currentPage - 1) })}
                className="px-3 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Anterior
              </Link>
            )}
            <span className="px-3 py-1 text-xs text-gray-400">
              {currentPage} / {totalPages}
            </span>
            {currentPage < totalPages && (
              <Link
                href={buildUrl({ page: String(currentPage + 1) })}
                className="px-3 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Próxima
              </Link>
            )}
          </div>
        )}
      </main>
    </>
  )
}
