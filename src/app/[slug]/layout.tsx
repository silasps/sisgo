import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'
import { notFound, redirect } from 'next/navigation'

const NAV = (slug: string) => [
  { href: `/${slug}`, label: 'Dashboard', icon: '◈' },
  { href: `/${slug}/pessoas`, label: 'Pessoas', icon: '👥' },
  { href: `/${slug}/obreiros`, label: 'Obreiros', icon: '⛪' },
  { href: `/${slug}/alunos`, label: 'Alunos', icon: '🎓' },
  { href: `/${slug}/escolas`, label: 'Escolas', icon: '📚' },
  { href: `/${slug}/ministerios`, label: 'Ministérios', icon: '🎵' },
  { href: `/${slug}/configuracoes`, label: 'Configurações', icon: '⚙' },
]

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> }

export default async function SlugLayout({ children, params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, active')
    .eq('slug', slug)
    .single()

  if (!org || !org.active) notFound()

  // Verifica acesso: superadmin ou usuário da org
  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  const role = (orgUser?.roles as unknown as { name: string } | null)?.name

  if (role !== 'superadmin') {
    // Verifica se pertence a esta org
    const { data: access } = await supabase
      .from('organization_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', org.id)
      .eq('active', true)
      .single()

    if (!access) redirect('/login')
  }

  return (
    <AppShell items={NAV(slug)} subtitle={org.name}>
      {children}
    </AppShell>
  )
}
