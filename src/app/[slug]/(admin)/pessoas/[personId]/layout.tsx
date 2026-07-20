import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { WorkspaceTabBar } from '@/components/layout/WorkspaceTabBar'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { PROFILE_ROLES, HEALTH_ROLES } from '@/lib/auth/permissions'

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

  type SchoolLinkRaw = { role: string; schools: { name: string } | null }
  type MinistryLinkRaw = { ministry_roles: { name: string } | null; ministries: { name: string } | null }
  const [{ data: schoolLinksRaw }, { data: ministryLinksRaw }] = await Promise.all([
    db.from('school_staff').select('role, schools(name)').eq('person_id', personId).eq('active', true),
    db.from('ministry_members').select('ministry_roles(name), ministries(name)').eq('person_id', personId).eq('active', true),
  ])
  const serveEmLabels = [
    ...((schoolLinksRaw ?? []) as unknown as SchoolLinkRaw[])
      .filter(l => l.schools)
      .map(l => `${l.schools!.name} (${l.role})`),
    ...((ministryLinksRaw ?? []) as unknown as MinistryLinkRaw[])
      .filter(l => l.ministries)
      .map(l => `${l.ministries!.name}${l.ministry_roles ? ` (${l.ministry_roles.name})` : ''}`),
  ]

  const base = `/${slug}/pessoas/${personId}`
  const tabs = [
    { href: `${base}/carteirinha`, label: 'Carteirinha' },
    ...(HEALTH_ROLES.includes(role as never) ? [{ href: `${base}/saude`, label: 'Saúde' }] : []),
  ]

  return (
    <>
      <Header
        title={person.full_name}
        actions={
          <Link href={`/${slug}/pessoas`} className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors">
            <ChevronLeft size={16} />
            Voltar
          </Link>
        }
      />
      <div className="px-4 md:px-6 pt-2.5 pb-2 bg-white border-b border-gray-100">
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-600">Serve em:</span>{' '}
          {serveEmLabels.length > 0 ? serveEmLabels.join(' · ') : 'Nenhum vínculo com escola ou ministério ainda.'}
        </p>
      </div>
      <WorkspaceTabBar tabs={tabs} />
      {children}
    </>
  )
}
