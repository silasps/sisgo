import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getRolePreview } from '@/lib/role-preview'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { userHasAnyRole, MANUTENCAO_ROLES } from '@/lib/auth/permissions'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string; msg?: string }>
}

type ServiceRequest = {
  id: string
  request_type: string
  subject: string
  description: string | null
  priority: string
  location_notes: string | null
  status: string
  created_at: string
  requester_id: string
  people: { full_name: string } | null
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  eletrica:   'Elétrica',
  hidraulica: 'Hidráulica',
  estrutura:  'Estrutura / Alvenaria',
  moveis:     'Móveis / Equipamentos',
  limpeza:    'Limpeza / Higiene',
  outro:      'Outro',
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pendente:   { label: 'Pendente',     cls: 'bg-yellow-100 text-yellow-800' },
  em_analise: { label: 'Em andamento', cls: 'bg-blue-100 text-blue-800' },
  resolvido:  { label: 'Resolvido',    cls: 'bg-green-100 text-green-800' },
  rejeitado:  { label: 'Rejeitado',    cls: 'bg-red-100 text-red-800' },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

export default async function ManutencaoPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { tab = 'abertas', msg } = await searchParams

  const supabase  = await createClient()
  const sbAdmin   = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id, role_accumulations').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name), extra_roles')
    .eq('user_id', user.id)
    .eq('active', true)

  const rows = (orgUsers ?? []) as unknown as Array<{
    organization_id: string | null
    roles: { name: string } | null
    extra_roles?: string[] | null
  }>
  const superadminRow  = rows.find(r => r.roles?.name === 'superadmin')
  const currentOrgRow  = rows.find(r => r.organization_id === org.id)
  const realRole       = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  if (!realRole) redirect('/login')

  const preview        = await getRolePreview(realRole)
  const role           = preview?.role ?? realRole
  const orgAccumulations = (org.role_accumulations as Record<string, string[]> | null) ?? {}
  const accRoles       = [...(orgAccumulations[role] ?? []), ...((currentOrgRow?.extra_roles as string[] | null) ?? [])]
  const allRoles       = [role, ...accRoles]
  const canManage      = userHasAnyRole(allRoles, MANUTENCAO_ROLES)

  // ── Server Actions ──────────────────────────────────────────────────────────

  const handleCreate = async (formData: FormData) => {
    'use server'
    const request_type   = String(formData.get('request_type') ?? '').trim()
    const subject        = String(formData.get('subject') ?? '').trim()
    const description    = String(formData.get('description') ?? '').trim() || null
    const priority       = String(formData.get('priority') ?? 'normal')
    const location_notes = String(formData.get('location_notes') ?? '').trim() || null
    if (!request_type || !subject) return

    const { data: { user: u } } = await (await createClient()).auth.getUser()
    if (!u) return
    const { data: ou } = await (await createClient())
      .from('organization_users')
      .select('roles(name)')
      .eq('user_id', u.id)
      .eq('organization_id', org.id)
      .eq('active', true)
      .maybeSingle() as { data: { roles: { name: string } | null } | null }
    const requesterRole = (ou as { roles?: { name: string } | null } | null)?.roles?.name ?? 'membro'

    await (await createClient()).from('service_requests').insert({
      organization_id: org.id,
      requester_id: u.id,
      requester_role: requesterRole,
      target_department: 'manutencao',
      request_type,
      subject,
      description,
      priority,
      location_notes,
      status: 'pendente',
    })
    redirect(`/${slug}/manutencao?msg=criado`)
  }

  const handleStatus = async (formData: FormData) => {
    'use server'
    const id     = String(formData.get('id') ?? '')
    const status = String(formData.get('status') ?? '')
    const { data: { user: u } } = await (await createClient()).auth.getUser()
    if (!u || !id || !status) return
    await (await createClient()).from('service_requests').update({
      status,
      reviewed_by: u.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    redirect(`/${slug}/manutencao?tab=${tab}`)
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  const activeStatuses = tab === 'resolvidas' ? ['resolvido', 'rejeitado'] : ['pendente', 'em_analise']
  const activeTab      = tab === 'resolvidas' ? 'resolvidas' : 'abertas'

  let requests: ServiceRequest[] = []

  if (canManage) {
    const { data } = await sbAdmin
      .from('service_requests')
      .select('id, request_type, subject, description, priority, location_notes, status, created_at, requester_id')
      .eq('organization_id', org.id)
      .eq('target_department', 'manutencao')
      .in('status', activeStatuses)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
    const rows = (data ?? []) as Omit<ServiceRequest, 'people'>[]

    const ids = [...new Set(rows.map(r => r.requester_id))]
    const { data: people } = ids.length > 0
      ? await sbAdmin.from('people').select('user_id, full_name').in('user_id', ids)
      : { data: [] }
    const nameMap = new Map((people ?? []).map((p: { user_id: string | null; full_name: string }) => [p.user_id, p.full_name]))

    requests = rows.map(r => ({ ...r, people: nameMap.has(r.requester_id) ? { full_name: nameMap.get(r.requester_id)! } : null }))
  } else {
    const { data } = await supabase
      .from('service_requests')
      .select('id, request_type, subject, description, priority, location_notes, status, created_at, requester_id')
      .eq('organization_id', org.id)
      .eq('target_department', 'manutencao')
      .eq('requester_id', user.id)
      .in('status', activeStatuses)
      .order('created_at', { ascending: false })
    requests = ((data ?? []) as Omit<ServiceRequest, 'people'>[]).map(r => ({ ...r, people: null }))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title="Manutenção"
        actions={
          canManage
            ? <Link href={`/${slug}/manutencao/estoque`} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">Estoque →</Link>
            : undefined
        }
      />

      <div className="flex-1 px-4 pb-8 max-w-3xl mx-auto w-full">

        {/* Formulário nova solicitação */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 mt-4">
          <h2 className="font-semibold text-gray-800 mb-3">Nova solicitação</h2>
          {msg === 'criado' && (
            <p className="mb-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Solicitação enviada com sucesso!</p>
          )}
          <form action={handleCreate} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
                <select name="request_type" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                  <option value="">Selecione…</option>
                  {Object.entries(REQUEST_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prioridade</label>
                <select name="priority" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                  <option value="normal">Normal</option>
                  <option value="urgente">🔴 Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assunto *</label>
              <input name="subject" required placeholder="Ex: Chuveiro do banheiro 2 com vazamento" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Local</label>
              <input name="location_notes" placeholder="Ex: Banheiro masculino, 1º andar" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descrição (opcional)</label>
              <textarea name="description" rows={3} placeholder="Descreva o problema com mais detalhes…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none" />
            </div>
            <button type="submit" className="self-start px-5 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
              Enviar solicitação
            </button>
          </form>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'abertas',    label: canManage ? 'Abertas' : 'Minhas solicitações' },
            { key: 'resolvidas', label: 'Resolvidas' },
          ].map(t => (
            <Link
              key={t.key}
              href={`/${slug}/manutencao?tab=${t.key}`}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-[var(--accent)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* Lista */}
        {requests.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Nenhuma solicitação encontrada.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map(req => {
              const s = STATUS_CONFIG[req.status] ?? { label: req.status, cls: 'bg-gray-100 text-gray-700' }
              return (
                <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type}
                      </span>
                      {req.priority === 'urgente' && (
                        <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">Urgente</span>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.cls}`}>{s.label}</span>
                  </div>

                  <p className="font-semibold text-gray-900">{req.subject}</p>

                  {req.location_notes && (
                    <p className="text-sm text-gray-500">📍 {req.location_notes}</p>
                  )}
                  {req.description && (
                    <p className="text-sm text-gray-600 whitespace-pre-line">{req.description}</p>
                  )}

                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-gray-100 mt-1">
                    <span className="text-xs text-gray-400">
                      {canManage && req.people?.full_name ? `${req.people.full_name} · ` : ''}
                      {fmtDate(req.created_at)}
                    </span>
                    {canManage && !['resolvido', 'rejeitado'].includes(req.status) && (
                      <div className="flex gap-2 flex-wrap">
                        {req.status === 'pendente' && (
                          <form action={handleStatus}>
                            <input type="hidden" name="id" value={req.id} />
                            <input type="hidden" name="status" value="em_analise" />
                            <button type="submit" className="text-xs px-3 py-1 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors">
                              Iniciar
                            </button>
                          </form>
                        )}
                        <form action={handleStatus}>
                          <input type="hidden" name="id" value={req.id} />
                          <input type="hidden" name="status" value="resolvido" />
                          <button type="submit" className="text-xs px-3 py-1 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 transition-colors">
                            Resolver
                          </button>
                        </form>
                        <form action={handleStatus}>
                          <input type="hidden" name="id" value={req.id} />
                          <input type="hidden" name="status" value="rejeitado" />
                          <button type="submit" className="text-xs px-3 py-1 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 transition-colors">
                            Rejeitar
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
