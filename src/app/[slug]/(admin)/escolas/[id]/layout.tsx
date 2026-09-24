import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { WorkspaceTabBar } from '@/components/layout/WorkspaceTabBar'
import { redirect, notFound } from 'next/navigation'
import { isManagementRole } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { getSchoolLink } from '@/lib/auth/unit-access'

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

  const { data: escola } = await supabase
    .from('schools')
    .select('id, name')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!escola) notFound()

  // Fora da gestão, quem entra é quem tem vínculo com ESTA escola (líder ou
  // obreiro), seja qual for o papel principal — ver lib/auth/unit-access.
  const link = isManagement ? null : await getSchoolLink({ userId: user.id, orgId, role, preview }, id)
  if (!isManagement && !link) redirect(`/${slug}/escolas`)

  const canConfigure = isManagement || link === 'lider'
  const base = `/${slug}/escolas/${id}`
  const tabs = [
    { href: base, label: 'Geral', icon: 'geral' as const },
    { href: `${base}/equipe`, label: 'Quadro de Obreiros', icon: 'equipe' as const },
    ...(canConfigure ? [
      { href: `${base}/pesquisa`, label: 'Pesquisa de Satisfação', icon: 'pesquisa' as const },
      { href: `${base}/configuracoes`, label: 'Configurações', icon: 'configuracoes' as const, alsoMatches: [`${base}/turmas`, `${base}/formulario`] },
    ] : []),
  ]

  return (
    <>
      <Header title={escola.name} backHref={isManagement ? `/${slug}/escolas` : undefined} />
      <WorkspaceTabBar tabs={tabs} />
      {children}
    </>
  )
}
