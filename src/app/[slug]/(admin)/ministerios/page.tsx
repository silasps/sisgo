import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isManagementRole } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { createMinistry } from './[id]/actions'
import { Music, Plus } from 'lucide-react'

type Props = { params: Promise<{ slug: string }> }

export default async function MinistriosPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()
  const orgId = org?.id ?? ''

  const { data: { user } } = await supabase.auth.getUser()
  const { role, preview } = user
    ? await getCurrentOrganizationRole(supabase, user.id, orgId)
    : { role: '', preview: null }
  const isManagement = isManagementRole(role)
  const canWrite = isManagement
  let allowedMinistryIds: string[] | null = null

  // Usuário vinculado a ministério → redireciona diretamente pro seu ministério,
  // ou (se lidera mais de um) mostra a listagem filtrada só aos dele
  if (role === 'lider_ministerio' && user) {
    const ministryIds = preview?.ministryId
      ? [preview.ministryId]
      : ((await supabase.from('ministry_leaders').select('ministry_id').eq('user_id', user.id)).data ?? []).map(r => r.ministry_id)

    if (ministryIds.length === 1) redirect(`/${slug}/ministerios/${ministryIds[0]}`)

    if (ministryIds.length === 0) {
      return (
        <>
          <Header title="Ministérios" />
          <main className="p-4 md:p-6">
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
              <Music className="size-8 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm">Nenhum ministério atribuído a você ainda.</p>
              <p className="text-gray-400 text-xs mt-1">Entre em contato com o DH da sua base.</p>
            </div>
          </main>
        </>
      )
    }

    allowedMinistryIds = ministryIds
  }

  if (role === 'obreiro_ministerio' && user) {
    if (preview?.ministryId) redirect(`/${slug}/ministerios/${preview.ministryId}`)

    const { data: staffProfile } = await supabase
      .from('staff_profiles')
      .select('person_id')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (staffProfile?.person_id) {
      const { data: memberRow } = await supabase
        .from('ministry_members')
        .select('ministry_id')
        .eq('person_id', staffProfile.person_id)
        .eq('active', true)
        .limit(1)
        .single()

      if (memberRow?.ministry_id) {
        redirect(`/${slug}/ministerios/${memberRow.ministry_id}`)
      }
    }

    return (
      <>
        <Header title="Ministérios" />
        <main className="p-4 md:p-6">
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-gray-500 text-sm">Nenhum ministério atribuído a você ainda.</p>
            <p className="text-gray-400 text-xs mt-1">Entre em contato com o DH da sua base.</p>
          </div>
        </main>
      </>
    )
  }

  const DEPT_ROLES = ['hospitalidade', 'secretaria', 'cozinha', 'manutencao']
  if (DEPT_ROLES.includes(role) && user) {
    const { data: linkedMinistry } = await supabase
      .from('ministries')
      .select('id')
      .eq('organization_id', orgId)
      .eq('linked_role', role)
      .maybeSingle()

    if (linkedMinistry?.id) {
      redirect(`/${slug}/ministerios/${linkedMinistry.id}`)
    }

    return (
      <>
        <Header title="Ministérios" />
        <main className="p-4 md:p-6">
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <Music className="size-8 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">Nenhum ministério vinculado à sua função ainda.</p>
            <p className="text-gray-400 text-xs mt-1">Entre em contato com o DH da sua base.</p>
          </div>
        </main>
      </>
    )
  }

  type MinistryRaw = {
    id: string
    name: string
    description: string | null
    active: boolean
    linked_role: string | null
    ministry_members: Array<{ id: string; active: boolean }>
    ministry_leaders: Array<{ user_id: string }>
  }

  let ministeriosQuery = supabase
    .from('ministries')
    .select('id, name, description, active, linked_role, ministry_members(id, active), ministry_leaders(user_id)')
    .eq('organization_id', orgId)
    .order('name')
  if (allowedMinistryIds) ministeriosQuery = ministeriosQuery.in('id', allowedMinistryIds)
  const { data } = await ministeriosQuery

  const ministerios = (data ?? []) as unknown as MinistryRaw[]

  const PRECONFIGURED = [
    { role: 'hospitalidade', name: 'Hospitalidade', description: 'Recepção, hospedagem e acolhimento' },
    { role: 'secretaria', name: 'Secretaria', description: 'Administração e finanças' },
    { role: 'dh', name: 'DH', description: 'Desenvolvimento humano e gestão de pessoas' },
    { role: 'cozinha', name: 'Cozinha', description: 'Alimentação e refeições' },
    { role: 'manutencao', name: 'Manutenção', description: 'Manutenção e infraestrutura' },
    { role: 'comunicacao', name: 'Comunicação', description: 'Anúncios e conteúdo da base' },
  ]
  const usedLinkedRoles = new Set(ministerios.map(m => m.linked_role).filter(Boolean))
  const availableFunctions = canWrite
    ? PRECONFIGURED.filter(p => !usedLinkedRoles.has(p.role))
    : []

  const quickCreate = async (formData: FormData) => {
    'use server'
    const linkedRole = formData.get('linked_role') as string
    const name = formData.get('name') as string
    const description = formData.get('description') as string | null
    if (!linkedRole || !name) return
    const id = await createMinistry(orgId, name, description, linkedRole)
    redirect(`/${slug}/ministerios/${id}?msg=criado`)
  }

  return (
    <>
      <Header
        title="Ministérios"
        actions={
          canWrite ? (
            <Link
              href={`/${slug}/ministerios/nova`}
              className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
            >
              + Novo Ministério
            </Link>
          ) : undefined
        }
      />
      <main className="p-4 md:p-6 space-y-6">
        {availableFunctions.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Funções disponíveis</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {availableFunctions.map(fn => (
                <form key={fn.role} action={quickCreate} className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/30">
                  <input type="hidden" name="linked_role" value={fn.role} />
                  <input type="hidden" name="name" value={fn.name} />
                  <input type="hidden" name="description" value={fn.description} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-700 text-sm">{fn.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fn.description}</p>
                  </div>
                  <button type="submit" className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-brand-600 bg-white border border-brand-200 rounded-lg px-3 py-2 hover:bg-brand-50 transition-colors">
                    <Plus size={14} /> Criar
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}

        {!ministerios.length && !availableFunctions.length && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <Music className="size-8 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400 text-sm">Nenhum ministério cadastrado ainda.</p>
            {canWrite && (
              <Link
                href={`/${slug}/ministerios/nova`}
                className="mt-4 inline-block px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
              >
                Criar primeiro ministério
              </Link>
            )}
          </div>
        )}

        {ministerios.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ministerios.map(m => {
              const memberCount = m.ministry_members.filter(mm => mm.active).length
              const hasLeader = m.ministry_leaders.length > 0
              return (
                <Link
                  key={m.id}
                  href={`/${slug}/ministerios/${m.id}`}
                  className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 cursor-pointer transition-all duration-200 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-gray-900 leading-snug group-hover:text-brand-600 transition-colors">{m.name}</p>
                      {m.linked_role && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium capitalize">{m.linked_role}</span>
                      )}
                    </div>
                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {m.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{m.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-auto">
                    <div className="flex items-center gap-3">
                      <span>{memberCount} membro{memberCount !== 1 ? 's' : ''}</span>
                      {!hasLeader && isManagement && (
                        <span className="text-orange-500 font-medium">Sem líder</span>
                      )}
                    </div>
                    <span className="text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Abrir →
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
