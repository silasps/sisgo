import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'

type Props = { params: Promise<{ slug: string }> }

export default async function ConfiguracoesPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: org } = await supabase.from('organizations').select('name, slug, email, city, state').eq('slug', slug).single()
  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name, label)')
    .eq('user_id', user?.id ?? '')
    .eq('active', true)
    .single()

  const role = (orgUser?.roles as unknown as { label: string } | null)?.label

  return (
    <>
      <Header title="Configurações" />
      <main className="p-4 md:p-6 max-w-lg space-y-4">
        <Section title="Minha conta">
          <Row label="E-mail" value={user?.email} />
          <Row label="Papel" value={role} />
        </Section>
        {org && (
          <Section title="Base">
            <Row label="Nome" value={org.name} />
            <Row label="Slug" value={org.slug} />
            <Row label="E-mail" value={org.email} />
            <Row label="Localização" value={[org.city, org.state].filter(Boolean).join(', ')} />
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
function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value || '—'}</dd>
    </div>
  )
}
