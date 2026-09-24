import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { notFound, redirect } from 'next/navigation'
import { AnnouncementList, type AnnouncementListItem } from '@/components/ui/AnnouncementList'
import { EmptyState } from '../dashboard/ui'
import { Megaphone } from 'lucide-react'

const PAGE_SIZE = 20

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }

type Row = AnnouncementListItem & { visible_to_roles: string[] | null; expires_at: string | null; publish_at: string | null }

export default async function AnunciosPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)

  const { data: rows } = await admin
    .from('base_announcements')
    .select('id, title, body, pinned, category, image_url, image_focal_x, image_focal_y, link_url, link_label, visible_to_roles, expires_at, publish_at, author_name, created_at')
    .eq('organization_id', org.id)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  const now = Date.now()
  const visible = ((rows ?? []) as Row[]).filter(a => {
    const rolesOk = !a.visible_to_roles || a.visible_to_roles.length === 0 || a.visible_to_roles.includes(role)
    const publishOk = !a.publish_at || new Date(a.publish_at).getTime() <= now
    const expiresOk = !a.expires_at || new Date(a.expires_at).getTime() >= now
    return rolesOk && publishOk && expiresOk
  })

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <Header title="Anúncios" />
      <main className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto overflow-y-auto flex-1">
        {pageItems.length === 0 ? (
          <EmptyState icon={Megaphone} label="Nenhum anúncio encontrado" />
        ) : (
          <AnnouncementList announcements={pageItems} variant="grid" />
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            {page > 1 && (
              <Link href={`/${slug}/anuncios?page=${page - 1}`} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                ← Anteriores
              </Link>
            )}
            <span className="text-xs text-gray-400">Página {page} de {totalPages}</span>
            {page < totalPages && (
              <Link href={`/${slug}/anuncios?page=${page + 1}`} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Próximos →
              </Link>
            )}
          </div>
        )}
      </main>
    </>
  )
}
