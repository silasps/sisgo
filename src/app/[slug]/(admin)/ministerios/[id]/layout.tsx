import { Header } from '@/components/layout/Header'
import { WorkspaceTabBar } from '@/components/layout/WorkspaceTabBar'
import { redirect, notFound } from 'next/navigation'
import { isManagementRole } from '@/lib/auth/permissions'
import { getOrgAndUser, getWorkspaceRole, getWorkspaceMinistry, getWorkspaceMinistryLink } from './_data'

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string; id: string }>
}

export default async function MinisterioWorkspaceLayout({ children, params }: Props) {
  const { slug, id } = await params

  const { user, orgId } = await getOrgAndUser(slug)
  if (!user || !orgId) notFound()

  const { role, preview } = await getWorkspaceRole(user.id, orgId)
  const isManagement = isManagementRole(role)
  // Papéis de departamento (hospitalidade, secretaria, cozinha, manutenção) só
  // entram no ministério vinculado à própria função — /ministerios já os
  // redireciona pra cá; sem essa checagem, batiam num notFound() indevido.
  const DEPT_ROLES = ['hospitalidade', 'secretaria', 'cozinha', 'manutencao']
  const isDeptRole = DEPT_ROLES.includes(role)

  const ministry = await getWorkspaceMinistry(orgId, id)
  if (!ministry) notFound()

  // Fora da gestão/departamento, quem entra é quem lidera ou é membro DESTE
  // ministério, seja qual for o papel principal — ver lib/auth/unit-access.
  const canEnterByRole = isManagement || (isDeptRole && ministry.linked_role === role)
  if (!canEnterByRole) {
    const link = await getWorkspaceMinistryLink(user.id, orgId, role, preview, id)
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
