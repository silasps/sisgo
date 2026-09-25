import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { CalendarPlus } from 'lucide-react'
import { deleteAnnouncement } from './actions'
import { AnnouncementForm } from './AnnouncementForm'
import { AnnouncementCard } from './AnnouncementCard'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ edit?: string }>
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
  image_zoom: number
  link_url: string | null
  link_label: string | null
  visible_to_roles: string[] | null
  expires_at: string | null
  publish_at: string | null
  author_name: string
  created_at: string
}

// Reaproveita o bucket público school-media (já usado pra imagem hero de
// escola) — sem migration de bucket nova. undefined = não mexe na imagem
// atual; senão sempre retorna os 4 campos juntos (imagem pode ter sumido,
// mas foco/zoom continuam fazendo sentido pra próxima vez que uma entrar).
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
  const zoom = Math.min(300, Math.max(100, Number(formData.get('image_zoom')) || 100))

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
      return { image_url: db.storage.from('school-media').getPublicUrl(path).data.publicUrl, image_focal_x: focalX, image_focal_y: focalY, image_zoom: zoom }
    }
    return { image_url: oldImageUrl ?? null, image_focal_x: focalX, image_focal_y: focalY, image_zoom: zoom }
  }
  if (removeImage) {
    const oldPath = extractPath(oldImageUrl)
    if (oldPath) await db.storage.from('school-media').remove([oldPath])
    return { image_url: null, image_focal_x: 50, image_focal_y: 50, image_zoom: 100 }
  }
  return { image_url: oldImageUrl ?? null, image_focal_x: focalX, image_focal_y: focalY, image_zoom: zoom }
}

export default async function ComunicacaoPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { edit: editId } = await searchParams
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
  const path = `/${slug}/comunicacao`

  // linkedRoles já resolve "líder/membro de um ministério com
  // linked_role='comunicacao'" com o mesmo cálculo usado no menu — inclusive
  // com preview (Visualizar como) preso a um ministério específico. Antes
  // esta página recalculava isso na mão, olhando só os vínculos reais do
  // usuário logado, então sumia (notFound) pra quem está só simulando o
  // papel via preview.
  const { role, linkedRoles } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const canManageAnnouncements = role === 'superadmin' || role === 'lider_base' || linkedRoles.includes('comunicacao')
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
    .select('id, title, body, pinned, category, image_url, image_focal_x, image_focal_y, image_zoom, link_url, link_label, visible_to_roles, expires_at, publish_at, author_name, created_at')
    .eq('organization_id', orgId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  const announcements = (announcementsRaw ?? []) as Announcement[]

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
    revalidatePath(path)
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
    revalidatePath(path)
  }

  return (
    <>
      <Header title="Comunicação" />
      <main className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <AnnouncementForm
            createAction={createAnnouncement}
            updateAction={updateAnnouncement}
            deleteAction={deleteAnnouncement}
            organizationId={orgId}
            path={path}
          />
          <Link
            href={`/${slug}/calendario`}
            className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline font-medium"
          >
            <CalendarPlus size={14} /> Criar evento no calendário
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
          {announcements.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6 sm:col-span-2 lg:col-span-3">Nenhum anúncio publicado ainda.</p>
          )}
          {announcements.map(a => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              createAction={createAnnouncement}
              updateAction={updateAnnouncement}
              deleteAction={deleteAnnouncement}
              organizationId={orgId}
              path={path}
              defaultOpen={a.id === editId}
            />
          ))}
        </div>
      </main>
    </>
  )
}
