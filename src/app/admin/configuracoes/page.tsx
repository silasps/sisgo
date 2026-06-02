import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'

type OrgUser = {
  organizations: { name: string; slug: string; email: string | null } | null
  roles: { name: string; label: string } | null
}

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let orgUser: OrgUser | null = null
  if (user) {
    const { data } = await supabase
      .from('organization_users')
      .select('organizations(name, slug, email), roles(name, label)')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()
    orgUser = data as unknown as OrgUser | null
  }

  const org = orgUser?.organizations
  const role = orgUser?.roles

  return (
    <>
      <Header title="Configurações" />
      <main className="p-6 max-w-lg space-y-6">
        <Section title="Minha conta">
          <InfoRow label="E-mail" value={user?.email} />
          <InfoRow label="Papel" value={role?.label} />
        </Section>

        {org && (
          <Section title="Minha base">
            <InfoRow label="Nome" value={org.name} />
            <InfoRow label="Slug" value={org.slug} />
            <InfoRow label="E-mail" value={org.email} />
          </Section>
        )}
      </main>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      <dl className="space-y-3">{children}</dl>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value ?? '—'}</dd>
    </div>
  )
}
