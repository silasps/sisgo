import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getRolePreview } from '@/lib/role-preview'
import { FormularioInscricao } from '@/app/[slug]/formulario/[token]/FormularioInscricao'

type Props = { params: Promise<{ slug: string; id: string }> }

export default async function VisualizarFormularioPage({ params }: Props) {
  const { slug, id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user.id).eq('active', true)
  const memberships = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
  const superadminRow = memberships.find(r => r.roles?.name === 'superadmin')
  const currentOrgRow = memberships.find(r => r.organization_id === org.id)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  const preview = await getRolePreview(realRole)
  const userRole = preview?.role ?? realRole
  if (!['superadmin', 'admin_base', 'lider_base', 'lider_eted'].includes(userRole)) notFound()

  const { data: school } = await supabase
    .from('schools')
    .select('id, name, form_config, organizations!inner(slug)')
    .eq('id', id)
    .eq('organizations.slug', slug)
    .single()
  if (!school) notFound()

  const config = (school.form_config as { hidden_fields?: string[]; payment_info?: string }) ?? {}

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="border-b border-gray-100 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">Pré-visualização</p>
          <h1 className="mt-0.5 text-lg font-bold text-gray-900">{school.name}</h1>
          <p className="mt-1 text-xs text-gray-500">Os campos são exibidos conforme a última configuração salva.</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6 md:p-8">
          <FormularioInscricao
            slug={slug}
            token="preview"
            applicationId="preview"
            schoolName={school.name}
            initialData={{}}
            hiddenFields={config.hidden_fields ?? []}
            paymentInfo={config.payment_info ?? null}
            initialLang="pt"
            printMode
          />
        </div>
      </main>
    </div>
  )
}
