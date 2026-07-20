import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import { AccountSettingsForm } from './AccountSettingsForm'

type Props = { params: Promise<{ slug: string }> }

export default async function ContaPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: identitiesData } = await supabase.auth.getUserIdentities()
  const identities = (identitiesData?.identities ?? []).map(i => ({
    id: i.identity_id,
    provider: i.provider,
    email: typeof i.identity_data?.email === 'string' ? i.identity_data.email : null,
  }))

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const displayName = [metadata.full_name, metadata.name, metadata.fullName, metadata.display_name]
    .find((v): v is string => typeof v === 'string' && v.trim().length > 0) ?? ''
  const avatarUrl = typeof metadata.avatar_url === 'string' && metadata.avatar_url.trim().length > 0
    ? metadata.avatar_url
    : null

  return (
    <>
      <Header title="Minha conta" backHref={`/${slug}/dashboard`} />
      <main className="p-4 md:p-6 space-y-8 max-w-2xl">
        <AccountSettingsForm
          slug={slug}
          userId={user.id}
          email={user.email ?? ''}
          name={displayName}
          avatarUrl={avatarUrl}
          identities={identities}
        />
      </main>
    </>
  )
}
