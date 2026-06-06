import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type Props = { params: Promise<{ slug: string }> }

const MANAGEMENT_ROLES = ['superadmin', 'admin_base', 'lider_base', 'dh']

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
  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', user?.id ?? '')
    .eq('active', true)
    .single()

  const role = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''
  const isManagement = MANAGEMENT_ROLES.includes(role)

  // Líder de ministério → redireciona diretamente para o seu ministério
  if (role === 'lider_ministerio' && user) {
    const { data: leaderRow } = await supabase
      .from('ministry_leaders')
      .select('ministry_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (leaderRow?.ministry_id) {
      redirect(`/${slug}/ministerios/${leaderRow.ministry_id}`)
    }

    return (
      <>
        <Header title="Ministérios" />
        <main className="p-4 md:p-6">
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-3xl mb-3">🎵</p>
            <p className="text-gray-500 text-sm">Nenhum ministério atribuído a você ainda.</p>
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
    ministry_members: Array<{ id: string; active: boolean }>
    ministry_leaders: Array<{ user_id: string }>
  }

  const { data } = await supabase
    .from('ministries')
    .select('id, name, description, active, ministry_members(id, active), ministry_leaders(user_id)')
    .eq('organization_id', orgId)
    .order('name')

  const ministerios = (data ?? []) as unknown as MinistryRaw[]

  return (
    <>
      <Header
        title="Ministérios"
        actions={
          isManagement ? (
            <Link
              href={`/${slug}/ministerios/nova`}
              className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
            >
              + Novo Ministério
            </Link>
          ) : undefined
        }
      />
      <main className="p-4 md:p-6">
        {!ministerios.length ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-3xl mb-3">🎵</p>
            <p className="text-gray-400 text-sm">Nenhum ministério cadastrado ainda.</p>
            {isManagement && (
              <Link
                href={`/${slug}/ministerios/nova`}
                className="mt-4 inline-block px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
              >
                Criar primeiro ministério
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ministerios.map(m => {
              const memberCount = m.ministry_members.filter(mm => mm.active).length
              const hasLeader = m.ministry_leaders.length > 0
              return (
                <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 leading-snug">{m.name}</p>
                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {m.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{m.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{memberCount} membro{memberCount !== 1 ? 's' : ''}</span>
                    {!hasLeader && isManagement && (
                      <span className="text-orange-500 font-medium">Sem líder</span>
                    )}
                  </div>
                  <Link
                    href={`/${slug}/ministerios/${m.id}`}
                    className="mt-auto text-center py-2 px-4 border border-brand-500 text-brand-600 rounded-lg text-sm font-medium hover:bg-brand-50 transition-colors"
                  >
                    Gerenciar
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
