import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { updateMinistry, assignLeader, removeLeader, createServiceRequest } from './actions'
import { isManagementRole } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { Users, CalendarDays, ClipboardList, ArrowRight } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ msg?: string }>
}

export default async function MinisterioOverviewPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { msg } = await searchParams

  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()
  const orgId = org.id

  const { role, preview } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const isManagement = isManagementRole(role)
  const isLiderMinisterio = role === 'lider_ministerio'
  const isObreiroMinisterio = role === 'obreiro_ministerio'

  const { data: ministry } = await supabase
    .from('ministries')
    .select('id, name, description, active')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!ministry) notFound()

  const [{ count: memberCount }, { count: pendingCount }, { count: upcomingEvents }] = await Promise.all([
    supabase.from('ministry_members').select('*', { count: 'exact', head: true }).eq('ministry_id', id).eq('active', true),
    supabase.from('ministry_pending_requests').select('*', { count: 'exact', head: true }).eq('ministry_id', id).eq('status', 'pendente'),
    sbAdmin.from('ministry_calendar_events').select('*', { count: 'exact', head: true }).eq('ministry_id', id).gte('starts_at', new Date().toISOString()),
  ])

  let leaderEmail: string | null = null
  let orgUsersForAssignment: Array<{ id: string; email: string }> = []

  if (isManagement) {
    const { data: leaderRow } = await supabase
      .from('ministry_leaders')
      .select('user_id')
      .eq('ministry_id', id)
      .single()

    if (leaderRow) {
      const { data: { user: lu } } = await sbAdmin.auth.admin.getUserById(leaderRow.user_id)
      leaderEmail = lu?.email ?? null
    }

    const { data: orgUsersData } = await supabase
      .from('organization_users')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('active', true)

    if (orgUsersData?.length) {
      const { data: { users: authUsers } } = await sbAdmin.auth.admin.listUsers({ perPage: 1000 })
      const orgUserSet = new Set(orgUsersData.map(u => u.user_id))
      orgUsersForAssignment = authUsers
        .filter(u => orgUserSet.has(u.id) && u.id !== (leaderRow?.user_id ?? ''))
        .map(u => ({ id: u.id, email: u.email ?? u.id }))
        .sort((a, b) => a.email.localeCompare(b.email))
    }
  }

  const handleUpdate = async (formData: FormData) => {
    'use server'
    await updateMinistry(ministry.id, {
      name: (formData.get('name') as string).trim(),
      description: (formData.get('description') as string).trim() || null,
      active: formData.get('active') === 'on',
    })
    redirect(`/${slug}/ministerios/${id}?msg=atualizado`)
  }

  const handleAssignLeader = async (formData: FormData) => {
    'use server'
    const userId = formData.get('user_id') as string
    if (!userId) return
    const sb = createAdminClient()
    const { data: liderRole } = await sb.from('roles').select('id').eq('name', 'lider_ministerio').single()
    if (liderRole) {
      await sb.from('organization_users')
        .update({ role_id: liderRole.id, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('organization_id', orgId)
    }
    await assignLeader(orgId, id, userId)
    redirect(`/${slug}/ministerios/${id}?msg=lider_atribuido`)
  }

  const handleRemoveLeader = async () => {
    'use server'
    await removeLeader(id)
    redirect(`/${slug}/ministerios/${id}`)
  }

  const handleServiceRequest = async (formData: FormData) => {
    'use server'
    const subject = (formData.get('subject') as string).trim()
    if (!subject) return
    await createServiceRequest(
      orgId, user.id, role,
      formData.get('target_department') as string,
      formData.get('request_type') as string,
      subject,
      (formData.get('description') as string) || null,
    )
    redirect(`/${slug}/ministerios/${id}?msg=servico_enviado`)
  }

  const msgs: Record<string, { text: string; cls: string }> = {
    criado:           { text: 'Ministério criado com sucesso.', cls: 'bg-green-50 border-green-200 text-green-700' },
    atualizado:       { text: 'Informações atualizadas.', cls: 'bg-green-50 border-green-200 text-green-700' },
    lider_atribuido:  { text: 'Líder atribuído com sucesso.', cls: 'bg-green-50 border-green-200 text-green-700' },
    servico_enviado:  { text: 'Solicitação de serviço enviada.', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  }
  const msgInfo = msg ? msgs[msg] : null

  const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
  const base = `/${slug}/ministerios/${id}`

  return (
    <main className="p-4 md:p-6 space-y-4 max-w-5xl overflow-y-auto flex-1">
      {msgInfo && (
        <div className={`border rounded-lg px-4 py-3 text-sm ${msgInfo.cls}`}>
          {msgInfo.text}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link href={`${base}/equipe`} className="group bg-white rounded-xl border border-gray-200 p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-50 p-2"><Users size={18} className="text-brand-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{memberCount ?? 0}</p>
              <p className="text-xs text-gray-500">Membros</p>
            </div>
          </div>
        </Link>
        <Link href={`${base}/equipe`} className="group bg-white rounded-xl border border-gray-200 p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2"><ClipboardList size={18} className="text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingCount ?? 0}</p>
              <p className="text-xs text-gray-500">Pendências</p>
            </div>
          </div>
        </Link>
        <Link href={`${base}/calendario`} className="group bg-white rounded-xl border border-gray-200 p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-50 p-2"><CalendarDays size={18} className="text-violet-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{upcomingEvents ?? 0}</p>
              <p className="text-xs text-gray-500">Eventos futuros</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Info card (read-only for líder/obreiro, editable for DH) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {isManagement ? (
          <>
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Informações</h2>
            <form action={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                <input name="name" defaultValue={ministry.name} required className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
                <textarea name="description" rows={2} defaultValue={ministry.description ?? ''} className={`${INPUT} resize-none`} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="active" defaultChecked={ministry.active} className="rounded border-gray-300 text-brand-500" />
                <span className="text-sm text-gray-700">Ministério ativo</span>
              </label>
              <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors">
                Salvar alterações
              </button>
            </form>
          </>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">{ministry.name}</h2>
              {ministry.description && <p className="text-sm text-gray-500 mt-1">{ministry.description}</p>}
            </div>
            <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${ministry.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {ministry.active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        )}
      </div>

      {/* Leader assignment (DH only) */}
      {isManagement && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Líder do Ministério</h2>
          {leaderEmail ? (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900">{leaderEmail}</p>
              <form action={handleRemoveLeader} className="mt-1">
                <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">Remover líder</button>
              </form>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-3">Sem líder atribuído.</p>
          )}
          {orgUsersForAssignment.length > 0 && (
            <details className={leaderEmail ? 'border-t border-gray-100 pt-3' : ''}>
              <summary className="text-sm text-brand-600 cursor-pointer select-none font-medium">
                {leaderEmail ? 'Trocar líder' : 'Atribuir líder'}
              </summary>
              <form action={handleAssignLeader} className="mt-3 space-y-2">
                <select name="user_id" required className={INPUT}>
                  <option value="">Selecionar usuário...</option>
                  {orgUsersForAssignment.map(u => (
                    <option key={u.id} value={u.id}>{u.email}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400">O papel do usuário será atualizado para Líder de Ministério.</p>
                <button type="submit" className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors">
                  Confirmar
                </button>
              </form>
            </details>
          )}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href={`${base}/equipe`}
          className="group bg-white rounded-xl border border-gray-200 p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">Equipe</p>
              <p className="text-xs text-gray-500 mt-0.5">Gerenciar membros, solicitações e transferências</p>
            </div>
            <ArrowRight size={16} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
          </div>
        </Link>
        <Link
          href={`${base}/calendario`}
          className="group bg-white rounded-xl border border-gray-200 p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">Calendário</p>
              <p className="text-xs text-gray-500 mt-0.5">Eventos, reuniões e devocionais do ministério</p>
            </div>
            <ArrowRight size={16} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
          </div>
        </Link>
      </div>

      {/* Reservas (líder) */}
      {isLiderMinisterio && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Reservas</h2>
          <p className="text-xs text-gray-400 mb-3">Solicite espaços para atividades do ministério ou quartos para convidados.</p>
          <Link href={`/${slug}/reservas`} className="block text-center w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
            Solicitar / Ver Reservas →
          </Link>
        </div>
      )}

      {/* Service request form (líder) */}
      {isLiderMinisterio && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Nova Solicitação de Serviço</h2>
          <p className="text-xs text-gray-400 mb-3">Para outros departamentos da base (hospitalidade, DH, secretaria, etc.)</p>
          <form action={handleServiceRequest} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Destino</label>
                <select name="target_department" required className={INPUT}>
                  <option value="hospitalidade">Hospitalidade</option>
                  <option value="dh">DH</option>
                  <option value="secretaria">Secretaria</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select name="request_type" required className={INPUT}>
                  <option value="convidar_professor">Convidar professor</option>
                  <option value="hospedagem">Hospedagem</option>
                  <option value="logistica">Logística</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assunto</label>
              <input name="subject" required placeholder="Resumo da solicitação..." className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
              <textarea name="description" rows={3} placeholder="Detalhes..." className={`${INPUT} resize-none`} />
            </div>
            <button type="submit" className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors">
              Enviar Solicitação
            </button>
          </form>
        </div>
      )}
    </main>
  )
}
