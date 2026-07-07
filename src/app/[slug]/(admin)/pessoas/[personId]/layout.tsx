import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { WorkspaceTabBar } from '@/components/layout/WorkspaceTabBar'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { MANAGEMENT_ROLES } from '@/lib/auth/permissions'

const PROFILE_ROLES = [...MANAGEMENT_ROLES, 'dh', 'secretaria', 'lider_eted']

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string; personId: string }>
}

export default async function PessoaWorkspaceLayout({ children, params }: Props) {
  const { slug, personId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!PROFILE_ROLES.includes(role as never)) redirect(`/${slug}/pessoas`)

  const db = createAdminClient()
  const { data: person } = await db
    .from('people')
    .select('id, full_name')
    .eq('id', personId)
    .eq('organization_id', org.id)
    .single()
  if (!person) notFound()

  const base = `/${slug}/pessoas/${personId}`
  const tabs = [
    { href: `${base}/carteirinha`, label: 'Carteirinha' },
    { href: `${base}/saude`, label: 'Saúde' },
  ]

  return (
    <>
      <Header
        title={person.full_name}
        actions={
          <Link href={`/${slug}/pessoas`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ChevronLeft size={16} />
            Voltar
          </Link>
        }
      />
      <WorkspaceTabBar tabs={tabs} />
      {children}
    </>
  )
}
