import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { isManagementRole } from '@/lib/auth/permissions'
import { getSchoolLink } from '@/lib/auth/unit-access'
import { FormularioInscricao } from '@/app/[slug]/formulario/[token]/FormularioInscricao'
import { resolveFormConfig, type FormConfig } from '@/lib/school/formConfig'

type Props = {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ classId?: string }>
}

export default async function VisualizarFormularioPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { classId } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: org } = await supabase.from('organizations').select('id, name').eq('slug', slug).single()
  if (!org) notFound()

  const { role, preview } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  const isManagement = isManagementRole(role)
  // Gestão que edita formulário, ou o líder DESTA escola (vínculo) — ver lib/auth/unit-access.
  const canEditForm = isManagement
    || (await getSchoolLink({ userId: user.id, orgId: org.id, role, preview }, id)) === 'lider'
  if (!canEditForm) notFound()

  const { data: school } = await supabase
    .from('schools')
    .select('id, name, school_type, form_config, organizations!inner(slug)')
    .eq('id', id)
    .eq('organizations.slug', slug)
    .single()
  if (!school) notFound()

  let classConfig: FormConfig | null = null
  if (classId) {
    const { data: turma } = await supabase
      .from('school_classes')
      .select('form_config')
      .eq('id', classId)
      .eq('school_id', id)
      .maybeSingle()
    classConfig = (turma?.form_config as FormConfig | null) ?? null
  }
  const { hiddenFields, paymentInfo, requiredOverrides } = resolveFormConfig(school.form_config as FormConfig, classConfig)

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
            orgName={org.name}
            schoolType={(school as unknown as { school_type: string | null }).school_type}
            initialData={{}}
            hiddenFields={hiddenFields}
            requiredOverrides={requiredOverrides}
            paymentInfo={paymentInfo}
            initialLang="pt"
            printMode
          />
        </div>
      </main>
    </div>
  )
}
