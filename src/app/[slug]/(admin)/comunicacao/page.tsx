import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { AUDIENCE_ROLES } from '@/lib/audience-roles'
import { ANNOUNCEMENT_CATEGORIES, CATEGORY_STYLES } from '@/lib/announcement-categories'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Pin, Clock, CalendarPlus, ListChecks, Pencil, Trash2 } from 'lucide-react'
import { FocalPointImageField } from '@/components/ui/FocalPointImageField'
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton'
import { SubmitButton } from '@/components/ui/SubmitButton'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ msg?: string; edit?: string }>
}

type Announcement = {
  id: string
  title: string
  body: string
  pinned: boolean
  category: string
  image_url: string | null
  image_focal_x: number
  image_focal_y: number
  link_url: string | null
  link_label: string | null
  visible_to_roles: string[] | null
  expires_at: string | null
  publish_at: string | null
  author_name: string
  created_at: string
}

const MSGS: Record<string, { text: string; cls: string }> = {
  publicado: { text: 'Anúncio publicado.', cls: 'bg-green-50 border-green-200 text-green-700' },
  atualizado: { text: 'Anúncio atualizado.', cls: 'bg-green-50 border-green-200 text-green-700' },
}

// Reaproveita o bucket público school-media (já usado pra imagem hero de
// escola) — sem migration de bucket nova. undefined = não mexe na imagem
// atual; senão sempre retorna os 3 campos juntos (imagem pode ter sumido,
// mas o foco continua fazendo sentido pra próxima vez que uma entrar).
async function uploadAnnouncementImage(
  db: ReturnType<typeof createAdminClient>,
  formData: FormData,
  orgId: string,
  oldImageUrl: string | null | undefined,
) {
  const file = formData.get('image') as File | null
  const removeImage = formData.get('remove_image') === '1'
  const focalX = Math.min(100, Math.max(0, Number(formData.get('image_focal_x')) || 50))
  const focalY = Math.min(100, Math.max(0, Number(formData.get('image_focal_y')) || 50))

  const extractPath = (url: string | null | undefined) => {
    const marker = '/school-media/'
    const idx = url ? url.indexOf(marker) : -1
    return idx === -1 ? null : url!.slice(idx + marker.length)
  }

  if (file && file.size > 0) {
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `announcements/${orgId}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error } = await db.storage.from('school-media').upload(path, buffer, { contentType: file.type })
    if (!error) {
      const oldPath = extractPath(oldImageUrl)
      if (oldPath) await db.storage.from('school-media').remove([oldPath])
      return { image_url: db.storage.from('school-media').getPublicUrl(path).data.publicUrl, image_focal_x: focalX, image_focal_y: focalY }
    }
    return { image_url: oldImageUrl ?? null, image_focal_x: focalX, image_focal_y: focalY }
  }
  if (removeImage) {
    const oldPath = extractPath(oldImageUrl)
    if (oldPath) await db.storage.from('school-media').remove([oldPath])
    return { image_url: null, image_focal_x: 50, image_focal_y: 50 }
  }
  return { image_url: oldImageUrl ?? null, image_focal_x: focalX, image_focal_y: focalY }
}

export default async function ComunicacaoPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { msg, edit: editId } = await searchParams
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
    .select('id, title, body, pinned, category, image_url, image_focal_x, image_focal_y, link_url, link_label, visible_to_roles, expires_at, publish_at, author_name, created_at')
    .eq('organization_id', orgId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  const announcements = (announcementsRaw ?? []) as Announcement[]
  const editing = editId ? announcements.find(a => a.id === editId) ?? null : null

  async function createAnnouncement(formData: FormData) {
    'use server'
    if (!canManageAnnouncements) return
    const title = (formData.get('title') as string).trim()
    const body = (formData.get('body') as string).trim()
    if (!title || !body) return
    const expiresOn = formData.get('expires_on') as string
    const publishOn = formData.get('publish_on') as string
    const visibleToRoles = formData.getAll('visible_to_roles') as string[]

    const db = createAdminClient()
    const image = await uploadAnnouncementImage(db, formData, orgId, null)

    await db.from('base_announcements').insert({
      organization_id: orgId,
      author_id: userId,
      author_name: authorName,
      title,
      body,
      category: (formData.get('category') as string) || 'aviso',
      pinned: formData.get('pinned') === 'on',
      visible_to_roles: visibleToRoles.length > 0 ? visibleToRoles : null,
      expires_at: expiresOn ? new Date(`${expiresOn}T23:59:59-03:00`).toISOString() : null,
      publish_at: publishOn ? new Date(`${publishOn}T00:00:00-03:00`).toISOString() : null,
      link_url: (formData.get('link_url') as string)?.trim() || null,
      link_label: (formData.get('link_label') as string)?.trim() || null,
      ...image,
    })
    redirect(`/${slug}/comunicacao?msg=publicado`)
  }

  async function updateAnnouncement(formData: FormData) {
    'use server'
    if (!canManageAnnouncements) return
    const id = formData.get('announcement_id') as string
    if (!id) return
    const title = (formData.get('title') as string).trim()
    const body = (formData.get('body') as string).trim()
    if (!title || !body) return
    const expiresOn = formData.get('expires_on') as string
    const publishOn = formData.get('publish_on') as string
    const visibleToRoles = formData.getAll('visible_to_roles') as string[]

    const db = createAdminClient()
    const { data: current } = await db.from('base_announcements').select('image_url').eq('id', id).eq('organization_id', orgId).single()
    const image = await uploadAnnouncementImage(db, formData, orgId, current?.image_url ?? null)

    await db.from('base_announcements').update({
      title,
      body,
      category: (formData.get('category') as string) || 'aviso',
      pinned: formData.get('pinned') === 'on',
      visible_to_roles: visibleToRoles.length > 0 ? visibleToRoles : null,
      expires_at: expiresOn ? new Date(`${expiresOn}T23:59:59-03:00`).toISOString() : null,
      publish_at: publishOn ? new Date(`${publishOn}T00:00:00-03:00`).toISOString() : null,
      link_url: (formData.get('link_url') as string)?.trim() || null,
      link_label: (formData.get('link_label') as string)?.trim() || null,
      ...image,
    }).eq('id', id).eq('organization_id', orgId)
    redirect(`/${slug}/comunicacao?msg=atualizado`)
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

  // Converte o timestamptz salvo (UTC) de volta pra "YYYY-MM-DD" no fuso da
  // base — um slice() ingênuo no ISO cru pode cair no dia seguinte quando o
  // horário salvo (23:59:59-03:00) cruza a meia-noite UTC.
  const dateInputValue = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : ''

  return (
    <>
      <Header title="Comunicação" />
      <main className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">
        {msg && MSGS[msg] && (
          <div className={`border rounded-lg px-4 py-3 text-sm max-w-2xl mx-auto ${MSGS[msg].cls}`}>
            {MSGS[msg].text}
          </div>
        )}

        <div id="anuncio-form" className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-700">{editing ? 'Editar anúncio' : 'Novo anúncio'}</h2>
            <div className="flex items-center gap-3">
              <Link
                href={`/${slug}/anuncios`}
                className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline font-medium"
              >
                <ListChecks size={14} /> Ver histórico completo
              </Link>
              <Link
                href={`/${slug}/calendario`}
                className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline font-medium"
              >
                <CalendarPlus size={14} /> Criar evento no calendário
              </Link>
            </div>
          </div>
          <form key={editing?.id ?? 'new'} action={editing ? updateAnnouncement : createAnnouncement} className="space-y-3">
            {editing && <input type="hidden" name="announcement_id" value={editing.id} />}
            <input
              name="title"
              placeholder="Título"
              required
              defaultValue={editing?.title ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <textarea
              name="body"
              placeholder="Texto do anúncio"
              required
              rows={4}
              defaultValue={editing?.body ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />

            <div>
              <label className="mb-1.5 block text-xs text-gray-500">Imagem (opcional)</label>
              <FocalPointImageField
                name="image"
                existingImageUrl={editing?.image_url}
                existingFocalX={editing?.image_focal_x}
                existingFocalY={editing?.image_focal_y}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Categoria</label>
                <select
                  name="category"
                  defaultValue={editing?.category ?? 'aviso'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  {ANNOUNCEMENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 self-end pb-2">
                <input type="checkbox" name="pinned" defaultChecked={editing?.pinned} className="size-4" />
                Fixar no topo
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <input
                name="link_url"
                type="url"
                placeholder="Link (opcional) — ex: inscrição, mais detalhes"
                defaultValue={editing?.link_url ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <input
                name="link_label"
                placeholder="Texto do botão (ex: Inscreva-se)"
                defaultValue={editing?.link_label ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Agendar publicação para
                <input type="date" name="publish_on" defaultValue={dateInputValue(editing?.publish_at ?? null)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Validade até
                <input type="date" name="expires_on" defaultValue={dateInputValue(editing?.expires_at ?? null)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
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
                    <input type="checkbox" name="visible_to_roles" value={r.value} defaultChecked={editing?.visible_to_roles?.includes(r.value) ?? false} className="size-3" />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <SubmitButton
                className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
                pendingText={editing ? 'Salvando…' : 'Publicando…'}
              >
                {editing ? 'Salvar alterações' : 'Publicar'}
              </SubmitButton>
              {editing && (
                <Link
                  href={`/${slug}/comunicacao`}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </Link>
              )}
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
          {announcements.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6 lg:col-span-2 xl:col-span-3">Nenhum anúncio publicado ainda.</p>
          )}
          {announcements.map(a => {
            const cat = CATEGORY_STYLES[a.category] ?? CATEGORY_STYLES.aviso
            const isScheduled = a.publish_at && new Date(a.publish_at).getTime() > Date.now()
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {a.image_url && (
                  <div className="w-full bg-gray-100" style={{ aspectRatio: '16 / 9' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.image_url} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${a.image_focal_x}% ${a.image_focal_y}%` }} />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {a.pinned && <Pin size={14} className="text-brand-500" />}
                      <h3 className="font-semibold text-gray-900 text-sm">{a.title}</h3>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${cat.className}`}>{cat.label}</span>
                      {isScheduled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                          <Clock size={10} /> Agendado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/${slug}/comunicacao?edit=${a.id}#anuncio-form`}
                        title="Editar"
                        aria-label="Editar anúncio"
                        className="text-gray-300 hover:text-brand-600 transition-colors p-0.5"
                      >
                        <Pencil size={14} />
                      </Link>
                      <form action={deleteAnnouncement}>
                        <input type="hidden" name="announcement_id" value={a.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Excluir o anúncio "${a.title}"? Essa ação não pode ser desfeita.`}
                          title="Excluir"
                          className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                        >
                          <Trash2 size={14} />
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-400">
                    <span>{a.author_name}</span>
                    <span>·</span>
                    <span>{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
                    {isScheduled && (
                      <>
                        <span>·</span>
                        <span>publica em {new Date(a.publish_at!).toLocaleDateString('pt-BR')}</span>
                      </>
                    )}
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
              </div>
            )
          })}
        </div>
      </main>
    </>
  )
}
