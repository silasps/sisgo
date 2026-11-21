'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { isManagementRole } from '@/lib/auth/permissions'
import { getSchoolLink } from '@/lib/auth/unit-access'
import { CONFIGURAVEL, resolveFormConfig, listFormTemplates, type FormConfig } from '@/lib/school/formConfig'
import { SCHOOL_TYPES } from '@/lib/schools'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { FormConfigFields } from '@/components/admin/FormConfigFields'

type Props = {
  params: Promise<{ slug: string; id: string; classId: string }>
  searchParams: Promise<{ template?: string }>
}

export default async function TurmaFormularioConfigPage({ params, searchParams }: Props) {
  const { slug, id, classId } = await params
  const { template: templateIdParam } = await searchParams

  const supabase = await createClient()
  const sb = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { role, preview } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  const isManagement = isManagementRole(role)
  // Gestão que edita formulário, ou o líder DESTA escola (vínculo) — ver
  // lib/auth/unit-access. Não existe "líder de turma" separado hoje.
  const canEditForm = isManagement
    || (await getSchoolLink({ userId: user.id, orgId: org.id, role, preview }, id)) === 'lider'
  if (!canEditForm) notFound()

  const { data: school } = await sb
    .from('schools')
    .select('id, name, form_config')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()
  if (!school) notFound()

  const { data: turma } = await sb
    .from('school_classes')
    .select('id, name, form_config')
    .eq('id', classId)
    .eq('school_id', id)
    .single()
  if (!turma) notFound()

  const schoolConfig = (school.form_config as FormConfig) ?? {}
  const classConfig = (turma.form_config as FormConfig) ?? null

  const templates = await listFormTemplates(sb, org.id)
  const appliedTemplate = templateIdParam ? templates.find(t => t.id === templateIdParam) ?? null : null

  const saved = resolveFormConfig(schoolConfig, classConfig)
  // Modelo aplicado via ?template= só muda a pré-visualização dos
  // checkboxes — nada é salvo até clicar em "Salvar configuração".
  const preview_ = appliedTemplate
    ? { hiddenFields: appliedTemplate.form_config.hidden_fields ?? [], requiredOverrides: appliedTemplate.form_config.required_overrides ?? {} }
    : saved

  async function salvarConfig(fd: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const db = adm()

    const todosOsCampos: string[] = []
    for (const secao of CONFIGURAVEL) {
      for (const campo of secao.campos) {
        todosOsCampos.push(`${secao.secao}.${campo.name}`)
      }
    }
    const hiddenFieldsToSave = todosOsCampos.filter(key => fd.get(key) !== 'on')
    const requiredOverridesToSave: Record<string, boolean> = {}
    for (const secao of CONFIGURAVEL) {
      for (const campo of secao.campos) {
        if (campo.requiredByDefault === undefined) continue
        const key = `${secao.secao}.${campo.name}`
        const val = fd.get(`${key}__required`)
        if (val === 'obrigatorio') requiredOverridesToSave[key] = true
        else if (val === 'opcional') requiredOverridesToSave[key] = false
      }
    }

    await db.from('school_classes')
      .update({ form_config: { hidden_fields: hiddenFieldsToSave, required_overrides: requiredOverridesToSave }, form_config_confirmed: true })
      .eq('id', classId)

    redirect(`/${slug}/escolas/${id}/turmas/${classId}/formulario?flash_success=${encodeURIComponent('Configuração da turma salva.')}`)
  }

  async function salvarComoModelo(fd: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const { getCurrentOrganizationRole: getRole } = await import('@/lib/auth/org-role')
    const { isManagementRole: isMgmt } = await import('@/lib/auth/permissions')
    const db = adm()

    // Salvar modelo afeta toda a organização — só gestão, não basta ser
    // líder desta escola/turma.
    const authClient = await createServerClient()
    const { data: { user: actionUser } } = await authClient.auth.getUser()
    if (!actionUser) return
    const { data: orgRow } = await db.from('organizations').select('id').eq('slug', slug).single()
    if (!orgRow) return
    const { role: actionRole } = await getRole(authClient, actionUser.id, orgRow.id)
    if (!isMgmt(actionRole)) return

    const name = (fd.get('template_name') as string | null)?.trim()
    if (!name) return
    const defaultForType = (fd.get('default_for_type') as string | null)?.trim() || null

    const todosOsCampos: string[] = []
    for (const secao of CONFIGURAVEL) {
      for (const campo of secao.campos) {
        todosOsCampos.push(`${secao.secao}.${campo.name}`)
      }
    }
    const hiddenFieldsToSave = todosOsCampos.filter(key => fd.get(key) !== 'on')
    const requiredOverridesToSave: Record<string, boolean> = {}
    for (const secao of CONFIGURAVEL) {
      for (const campo of secao.campos) {
        if (campo.requiredByDefault === undefined) continue
        const key = `${secao.secao}.${campo.name}`
        const val = fd.get(`${key}__required`)
        if (val === 'obrigatorio') requiredOverridesToSave[key] = true
        else if (val === 'opcional') requiredOverridesToSave[key] = false
      }
    }

    if (defaultForType) {
      await db.from('school_form_templates')
        .update({ default_for_school_type: null })
        .eq('organization_id', orgRow.id)
        .eq('default_for_school_type', defaultForType)
    }

    await db.from('school_form_templates')
      .upsert(
        { organization_id: orgRow.id, name, form_config: { hidden_fields: hiddenFieldsToSave, required_overrides: requiredOverridesToSave }, default_for_school_type: defaultForType, created_by: actionUser.id },
        { onConflict: 'organization_id,name' },
      )

    redirect(`/${slug}/escolas/${id}/turmas/${classId}/formulario?flash_success=${encodeURIComponent(`Modelo "${name}" salvo.`)}`)
  }

  const totalCampos = CONFIGURAVEL.reduce((acc, s) => acc + s.campos.length, 0)
  const totalAtivos = totalCampos - preview_.hiddenFields.length

  return (
    <>
      <div className="h-16 shrink-0 sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href={`/${slug}/escolas/${id}/turmas/${classId}`} className="text-sm text-gray-500 hover:text-gray-800">
              ← {turma.name}
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900">Configurar formulário</span>
          </div>
          <Link
            href={`/${slug}/escolas/${id}/formulario/visualizar?classId=${classId}`}
            target="_blank"
            className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            Visualizar formulário ↗
          </Link>
        </div>
      </div>

      <main className="p-4 md:p-6 max-w-2xl mx-auto">

        <div className="bg-indigo-600 text-white rounded-2xl p-5 mb-5">
          <h1 className="text-lg font-black">Campos do formulário desta turma</h1>
          <p className="text-indigo-100 text-sm mt-1">
            Desative os campos que não fazem parte do processo seletivo desta turma. Isso não
            muda o padrão da escola, nem afeta as outras turmas dela.
          </p>
          <p className="text-indigo-200 text-xs mt-2">
            {totalAtivos} de {totalCampos} campos ativos
          </p>
        </div>

        <p className="text-xs text-gray-400 mb-3">
          Informações de pagamento são definidas no nível da escola —{' '}
          <Link href={`/${slug}/escolas/${id}/formulario`} className="underline hover:text-gray-600">
            editar lá
          </Link>.
        </p>

        <form action={salvarConfig} className="space-y-3">
          <FormConfigFields
            sections={CONFIGURAVEL}
            savedHiddenFields={saved.hiddenFields}
            savedRequiredOverrides={saved.requiredOverrides}
            previewHiddenFields={preview_.hiddenFields}
            previewRequiredOverrides={preview_.requiredOverrides}
            templates={templates}
            appliedTemplateId={appliedTemplate?.id ?? null}
            baseHref={`/${slug}/escolas/${id}/turmas/${classId}/formulario`}
          />

          {isManagement && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Salvar como modelo</h3>
              <p className="text-xs text-gray-400 mb-3">
                Guarda os campos marcados acima como um modelo reaproveitável — qualquer escola ou
                turma da organização vai poder aplicá-lo depois. Usar o nome de um modelo já
                existente sobrescreve ele.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input name="template_name" placeholder="Nome do modelo (ex: Seminário Nacional)"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                <select name="default_for_type" defaultValue=""
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="">Não definir como padrão</option>
                  {SCHOOL_TYPES.map(t => <option key={t.value} value={t.value}>Padrão de: {t.label}</option>)}
                </select>
                <SubmitButton formAction={salvarComoModelo} pendingText="Salvando modelo…"
                  className="px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors whitespace-nowrap">
                  Salvar como modelo…
                </SubmitButton>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2 pb-8">
            <Link href={`/${slug}/escolas/${id}/turmas/${classId}`}
              className="flex-1 text-center px-4 py-3 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium">
              Cancelar
            </Link>
            <SubmitButton formAction={salvarConfig} pendingText="Salvando..."
              className="flex-1 px-4 py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-xl transition-colors">
              Salvar configuração
            </SubmitButton>
          </div>
        </form>
      </main>
    </>
  )
}
