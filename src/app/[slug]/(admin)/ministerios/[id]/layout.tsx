import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { WorkspaceTabBar } from '@/components/layout/WorkspaceTabBar'
import { redirect, notFound } from 'next/navigation'
import { isManagementRole } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string; id: string }>
}

export default async function MinisterioWorkspaceLayout({ children, params }: Props) {
  const { slug, id } = await params
  const supabase = await createClient()

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

  if (!isManagement && !isLiderMinisterio && !isObreiroMinisterio) notFound()

  const { data: ministry } = await supabase
    .from('ministries')
    .select('id, name')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!ministry) notFound()

  if (isLiderMinisterio) {
    if (preview?.ministryId) {
      if (preview.ministryId !== id) redirect(`/${slug}/ministerios`)
    } else {
      const { data: lc } = await supabase
        .from('ministry_leaders')
        .select('id')
        .eq('ministry_id', id)
        .eq('user_id', user.id)
        .single()
      if (!lc) redirect(`/${slug}/ministerios`)
    }
  }

  if (isObreiroMinisterio) {
    if (preview?.ministryId) {
      if (preview.ministryId !== id) redirect(`/${slug}/ministerios`)
    } else {
      const { data: staffProfile } = await supabase
        .from('staff_profiles')
        .select('person_id')
        .eq('organization_id', orgId)
        .eq('user_id', user.id)
        .single()

      const { data: memberLink } = staffProfile?.person_id
        ? await supabase
          .from('ministry_members')
          .select('id')
          .eq('ministry_id', id)
          .eq('person_id', staffProfile.person_id)
          .eq('active', true)
          .single()
        : { data: null }

      if (!memberLink) redirect(`/${slug}/ministerios`)
    }
  }

  const base = `/${slug}/ministerios/${id}`
  const tabs = [
    { href: base, label: 'Chat', icon: 'chat' as const },
    { href: `${base}/equipe`, label: 'Quadro de Obreiros', icon: 'equipe' as const },
  ]

  return (
    <>
      <Header title={ministry.name} backHref={isManagement ? `/${slug}/ministerios` : undefined} />
      <WorkspaceTabBar tabs={tabs} />
      {children}
    </>
  )
}
