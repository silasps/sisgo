import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import { BrandingForm } from './BrandingForm'

type Props = { params: Promise<{ slug: string }> }

const BRANDING_ROLES = ['superadmin', 'lider_base']

export default async function ConfiguracoesPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, email, city, state, logo_url, accent_color')
    .eq('slug', slug)
    .single()

  if (!org) notFound()

  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name, label)')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  const roles     = orgUser?.roles as unknown as { name: string; label: string } | null
  const roleName  = roles?.name  ?? ''
  const roleLabel = roles?.label ?? ''

  const canBrand = BRANDING_ROLES.includes(roleName)

  return (
    <>
      <Header title="Configurações" />
      <main className="p-4 md:p-6 space-y-8 max-w-2xl">

        <Section title="Minha conta">
          <Row label="E-mail" value={user.email} />
          <Row label="Papel"  value={roleLabel} />
        </Section>

        <Section title="Base">
          <Row label="Nome"        value={org.name} />
          <Row label="Slug"        value={org.slug} />
          <Row label="E-mail"      value={org.email} />
          <Row label="Localização" value={[org.city, org.state].filter(Boolean).join(', ')} />
        </Section>

        {canBrand ? (
          <BrandingForm
            orgId={org.id}
            orgSlug={slug}
            orgName={org.name}
            currentLogoUrl={(org as { logo_url?: string | null }).logo_url ?? null}
            currentAccentColor={(org as { accent_color?: string }).accent_color ?? 'laranja'}
          />
        ) : (
          <div className="rounded-xl border border-dark-800 bg-dark-900 p-6 opacity-60">
            <p className="text-sm font-semibold text-white uppercase tracking-widest mb-1">Identidade Visual</p>
            <p className="text-xs text-gray-500">Apenas o líder da base pode personalizar a logo e a cor de destaque.</p>
          </div>
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
