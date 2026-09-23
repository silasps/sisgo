import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { WorkspaceTabBar } from '@/components/layout/WorkspaceTabBar'
import { redirect, notFound } from 'next/navigation'
import { isManagementRole } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { getMinistryLink } from '@/lib/auth/unit-access'

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
  // Papéis de departamento (hospitalidade, secretaria, cozinha, manutenção) só
  // entram no ministério vinculado à própria função — /ministerios já os
  // redireciona pra cá; sem essa checagem, batiam num notFound() indevido.
  const DEPT_ROLES = ['hospitalidade', 'secretaria', 'cozinha', 'manutencao']
  const isDeptRole = DEPT_ROLES.includes(role)

  const { data: ministry } = await supabase
    .from('ministries')
    .select('id, name, linked_role')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!ministry) notFound()

  // Fora da gestão/departamento, quem entra é quem lidera ou é membro DESTE
  // ministério, seja qual for o papel principal — ver lib/auth/unit-access.
  const canEnterByRole = isManagement || (isDeptRole && ministry.linked_role === role)
  if (!canEnterByRole) {
    const link = await getMinistryLink({ userId: user.id, orgId, role, preview }, id)
    if (!link) redirect(`/${slug}/ministerios`)
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
