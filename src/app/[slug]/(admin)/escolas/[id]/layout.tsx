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

export default async function EscolaWorkspaceLayout({ children, params }: Props) {
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
  const isLiderEted = role === 'lider_eted'
  const isObreiroEted = role === 'obreiro_eted'

  if (!isManagement && !isLiderEted && !isObreiroEted) notFound()

  const { data: escola } = await supabase
    .from('schools')
    .select('id, name')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!escola) notFound()

  if (isLiderEted) {
    if (preview?.schoolId) {
      if (preview.schoolId !== id) redirect(`/${slug}/escolas`)
    } else {
      const { data: lc } = await supabase
        .from('school_leaders')
        .select('id')
        .eq('school_id', id)
        .eq('user_id', user.id)
        .single()
      if (!lc) redirect(`/${slug}/escolas`)
    }
  }

  if (isObreiroEted) {
    if (preview?.schoolId) {
      if (preview.schoolId !== id) redirect(`/${slug}/escolas`)
    } else {
      const { data: staffProfile } = await supabase
        .from('staff_profiles')
        .select('person_id')
        .eq('organization_id', orgId)
        .eq('user_id', user.id)
        .single()

      const { data: staffLink } = staffProfile?.person_id
        ? await supabase
          .from('school_staff')
          .select('id')
          .eq('school_id', id)
          .eq('person_id', staffProfile.person_id)
          .eq('active', true)
          .single()
        : { data: null }

      if (!staffLink) redirect(`/${slug}/escolas`)
    }
  }

  const canConfigure = isManagement || isLiderEted
  const base = `/${slug}/escolas/${id}`
  const tabs = [
    { href: base, label: 'Geral', icon: 'geral' as const },
    { href: `${base}/equipe`, label: 'Quadro de Obreiros', icon: 'equipe' as const },
    ...(canConfigure ? [{ href: `${base}/configuracoes`, label: 'Configurações', icon: 'configuracoes' as const, alsoMatches: [`${base}/turmas`, `${base}/formulario`] }] : []),
  ]

  return (
    <>
      <Header title={escola.name} backHref={isManagement ? `/${slug}/escolas` : undefined} />
      <WorkspaceTabBar tabs={tabs} />
      {children}
    </>
  )
}
