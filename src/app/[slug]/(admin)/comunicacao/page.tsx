import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { AUDIENCE_ROLES } from '@/lib/audience-roles'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Pin, Trash2, CalendarPlus } from 'lucide-react'

type Props = { params: Promise<{ slug: string }> }

type Announcement = {
  id: string
  title: string
  body: string
  pinned: boolean
  visible_to_roles: string[] | null
  expires_at: string | null
  author_name: string
  created_at: string
}

export default async function ComunicacaoPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .single()
  if (!org) notFound()

  const orgId = org.id
  const userId = user.id

  const { role } = await getCurrentOrganizationRole(supabase, user.id, orgId)

  const myMinistryIds: string[] = []
  if (role === 'lider_ministerio' || role === 'obreiro_ministerio') {
    const { data: leaderRows } = await admin.from('ministry_leaders').select('ministry_id').eq('organization_id', orgId).eq('user_id', userId)
    myMinistryIds.push(...(leaderRows ?? []).map(row => row.ministry_id as string))

    const { data: staffProfile } = await admin.from('staff_profiles').select('person_id').eq('organization_id', orgId).eq('user_id', userId).single()
    if (staffProfile?.person_id) {
      const { data: memberRows } = await admin.from('ministry_members').select('ministry_id').eq('person_id', staffProfile.person_id).eq('active', true)
      myMinistryIds.push(...(memberRows ?? []).map(row => row.ministry_id as string))
    }
  }

  const comunicacaoMinistryIds = myMinistryIds.length > 0
    ? ((await admin.from('ministries').select('id').eq('organization_id', orgId).eq('linked_role', 'comunicacao')).data ?? []).map(row => row.id as string)
    : []
  const isComunicacaoMember = myMinistryIds.some(id => comunicacaoMinistryIds.includes(id))
  const canManageAnnouncements = role === 'superadmin' || role === 'lider_base' || isComunicacaoMember
  if (!canManageAnnouncements) notFound()

  const { data: profile } = await admin
    .from('staff_profiles')
    .select('person_id, people(full_name)')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .single()
  const authorName = (profile?.people as unknown as { full_name: string } | null)?.full_name ?? user.email ?? 'Anônimo'

  const { data: announcementsRaw } = await admin
    .from('base_announcements')
    .select('id, title, body, pinned, visible_to_roles, expires_at, author_name, created_at')
    .eq('organization_id', orgId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  const announcements = (announcementsRaw ?? []) as Announcement[]

  async function createAnnouncement(formData: FormData) {
    'use server'
    if (!canManageAnnouncements) return
    const title = (formData.get('title') as string).trim()
    const body = (formData.get('body') as string).trim()
    const expiresOn = formData.get('expires_on') as string
    const visibleToRoles = formData.getAll('visible_to_roles') as string[]
    if (!title || !body) return

    const db = createAdminClient()
    await db.from('base_announcements').insert({
      organization_id: orgId,
      author_id: userId,
      author_name: authorName,
      title,
      body,
      pinned: formData.get('pinned') === 'on',
      visible_to_roles: visibleToRoles.length > 0 ? visibleToRoles : null,
      expires_at: expiresOn ? new Date(`${expiresOn}T23:59:59-03:00`).toISOString() : null,
    })
    redirect(`/${slug}/comunicacao`)
  }

  async function deleteAnnouncement(formData: FormData) {
    'use server'
    if (!canManageAnnouncements) return
    const id = formData.get('announcement_id') as string
    if (!id) return
    const db = createAdminClient()
    await db.from('base_announcements').delete().eq('organization_id', orgId).eq('id', id)
    redirect(`/${slug}/comunicacao`)
  }

  return (
    <>
      <Header title="Comunicação" />
      <main className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1 max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Novo anúncio</h2>
            <Link
              href={`/${slug}/calendario`}
              className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline font-medium"
            >
              <CalendarPlus size={14} /> Criar evento no calendário
            </Link>
          </div>
          <form action={createAnnouncement} className="space-y-3">
            <input
              name="title"
              placeholder="Título"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <textarea
              name="body"
              placeholder="Texto do anúncio"
              required
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="pinned" className="size-4" />
                Fixar no topo
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Validade até
                <input type="date" name="expires_on" className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
              </label>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-gray-500">
                Quem vê <span className="text-gray-400">(nenhum marcado = todos)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {AUDIENCE_ROLES.map(r => (
                  <label
                    key={r.value}
                    className="flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-600 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700"
                  >
                    <input type="checkbox" name="visible_to_roles" value={r.value} className="size-3" />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-brand-500 text-white font-medium rounded-lg text-sm hover:bg-brand-600 transition-colors"
            >
              Publicar
            </button>
          </form>
        </div>

        <div className="space-y-3">
          {announcements.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum anúncio publicado ainda.</p>
          )}
          {announcements.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {a.pinned && <Pin size={14} className="text-brand-500" />}
                  <h3 className="font-semibold text-gray-900 text-sm">{a.title}</h3>
                </div>
                <form action={deleteAnnouncement}>
                  <input type="hidden" name="announcement_id" value={a.id} />
                  <button type="submit" className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </form>
              </div>
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.body}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-400">
                <span>{a.author_name}</span>
                <span>·</span>
                <span>{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
                {a.expires_at && (
                  <>
                    <span>·</span>
                    <span>até {new Date(a.expires_at).toLocaleDateString('pt-BR')}</span>
                  </>
                )}
                {a.visible_to_roles && a.visible_to_roles.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{a.visible_to_roles.map(r => AUDIENCE_ROLES.find(o => o.value === r)?.label ?? r).join(', ')}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
