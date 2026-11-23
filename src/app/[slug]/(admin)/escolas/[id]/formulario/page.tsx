'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { isManagementRole } from '@/lib/auth/permissions'
import { getSchoolLink } from '@/lib/auth/unit-access'
import { CONFIGURAVEL, FORM_TEMPLATE_NAMES, listFormTemplates, type FormConfig } from '@/lib/school/formConfig'
import { FormConfigFields } from '@/components/admin/FormConfigFields'

type Props = { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ template?: string }> }

export default async function EscolaFormularioConfigPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { template: templateIdParam } = await searchParams

  const supabase = await createClient()
  const sb = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { role, preview } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  const isManagement = isManagementRole(role)
  // Gestão que edita formulário, ou o líder DESTA escola (vínculo) — ver lib/auth/unit-access.
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

  const config = (school.form_config as FormConfig) ?? {}
  const paymentInfo = config.payment_info ?? ''

  const templates = await listFormTemplates(sb, org.id)
  const appliedTemplate = templateIdParam ? templates.find(t => t.id === templateIdParam) ?? null : null
  const saved = { hiddenFields: config.hidden_fields ?? [], requiredOverrides: config.required_overrides ?? {} }
  // Modelo aplicado via ?template= só muda a pré-visualização dos
  // checkboxes — nada é salvo até clicar em "Salvar configuração".
  const preview_ = appliedTemplate
    ? { hiddenFields: appliedTemplate.form_config.hidden_fields ?? [], requiredOverrides: appliedTemplate.form_config.required_overrides ?? {} }
    : saved

  async function salvarConfig(fd: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const db = adm()

    // Todos os campos possíveis — os que NÃO vieram no form estão desativados
    const todosOsCampos: string[] = []
    for (const secao of CONFIGURAVEL) {
      for (const campo of secao.campos) {
        todosOsCampos.push(`${secao.secao}.${campo.name}`)
      }
    }

    const hiddenFields = todosOsCampos.filter(key => fd.get(key) !== 'on')
    const paymentInfo = (fd.get('payment_info') as string | null)?.trim() || null
    const requiredOverrides: Record<string, boolean> = {}
    for (const secao of CONFIGURAVEL) {
      for (const campo of secao.campos) {
        if (campo.requiredByDefault === undefined) continue
        const key = `${secao.secao}.${campo.name}`
        const val = fd.get(`${key}__required`)
        if (val === 'obrigatorio') requiredOverrides[key] = true
        else if (val === 'opcional') requiredOverrides[key] = false
      }
    }

    await db.from('schools')
      .update({ form_config: { hidden_fields: hiddenFields, payment_info: paymentInfo, required_overrides: requiredOverrides } })
      .eq('id', id)

    redirect(`/${slug}/escolas/${id}/formulario?flash_success=${encodeURIComponent('Configuração da escola salva.')}`)
  }

  async function salvarComoModelo(fd: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const { getCurrentOrganizationRole: getRole } = await import('@/lib/auth/org-role')
    const { isManagementRole: isMgmt } = await import('@/lib/auth/permissions')
    const db = adm()

    // Salvar modelo afeta toda a organização (outras escolas/turmas podem
    // aplicá-lo depois) — só gestão, não basta ser líder desta escola.
    const authClient = await createServerClient()
    const { data: { user: actionUser } } = await authClient.auth.getUser()
    if (!actionUser) return
    const { data: orgRow } = await db.from('organizations').select('id').eq('slug', slug).single()
    if (!orgRow) return
    const { role: actionRole } = await getRole(authClient, actionUser.id, orgRow.id)
    if (!isMgmt(actionRole)) return

    const name = (fd.get('template_name') as string | null)?.trim()
    if (!name || !(FORM_TEMPLATE_NAMES as readonly string[]).includes(name)) return

    const todosOsCampos: string[] = []
    for (const secao of CONFIGURAVEL) {
      for (const campo of secao.campos) {
        todosOsCampos.push(`${secao.secao}.${campo.name}`)
      }
    }
    const hiddenFields = todosOsCampos.filter(key => fd.get(key) !== 'on')
    const requiredOverrides: Record<string, boolean> = {}
    for (const secao of CONFIGURAVEL) {
      for (const campo of secao.campos) {
        if (campo.requiredByDefault === undefined) continue
        const key = `${secao.secao}.${campo.name}`
        const val = fd.get(`${key}__required`)
        if (val === 'obrigatorio') requiredOverrides[key] = true
        else if (val === 'opcional') requiredOverrides[key] = false
      }
    }

    // Salvar como modelo também aplica a config atual a esta escola — o
    // usuário está editando os campos pensando nesta escola, não só no
    // modelo abstrato; sem isso, a página pública não reflete a mudança.
    const paymentInfo = (fd.get('payment_info') as string | null)?.trim() || null
    await db.from('schools')
      .update({ form_config: { hidden_fields: hiddenFields, payment_info: paymentInfo, required_overrides: requiredOverrides } })
      .eq('id', id)

    await db.from('school_form_templates')
      .upsert(
        { organization_id: orgRow.id, name, form_config: { hidden_fields: hiddenFields, required_overrides: requiredOverrides }, created_by: actionUser.id },
        { onConflict: 'organization_id,name' },
      )

    redirect(`/${slug}/escolas/${id}/formulario?flash_success=${encodeURIComponent(`Modelo "${name}" atualizado e aplicado a esta escola.`)}`)
  }

  const totalCampos = CONFIGURAVEL.reduce((acc, s) => acc + s.campos.length, 0)
  const totalAtivos = totalCampos - preview_.hiddenFields.length

  return (
    <>
      <div className="h-16 shrink-0 sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
          <Link href={`/${slug}/escolas/${id}`} className="text-sm text-gray-500 hover:text-gray-800">
            ← {school.name}
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">Configurar formulário</span>
          </div>
          <Link
            href={`/${slug}/escolas/${id}/formulario/visualizar`}
            target="_blank"
            className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            Visualizar formulário ↗
          </Link>
        </div>
      </div>

      <main className="p-4 md:p-6 max-w-2xl mx-auto">

        <div className="bg-indigo-600 text-white rounded-2xl p-5 mb-5">
          <h1 className="text-lg font-black">Campos do formulário</h1>
          <p className="text-indigo-100 text-sm mt-1">
            Desative os campos que não fazem parte do processo seletivo desta escola. Esse é o
            padrão herdado por toda turma nova — turmas específicas podem ter sua própria
            configuração em Turma → Formulário.
          </p>
          <p className="text-indigo-200 text-xs mt-2">
            {totalAtivos} de {totalCampos} campos ativos
          </p>
        </div>

        <form action={salvarConfig} className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Informações de pagamento</h3>
            <p className="text-xs text-gray-400 mb-3">
              Aparece pro candidato assim que ele termina de enviar a inscrição — chave Pix, dados
              bancários, cartão etc. Deixe em branco pra não mostrar nada.
            </p>
            <textarea
              name="payment_info"
              defaultValue={paymentInfo}
              rows={5}
              placeholder={'Ex: Pix (CPF): 000.000.000-00 — Fulano de Tal\nOu transferência: Banco X, ag. 0000, cc 00000-0'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>

          <FormConfigFields
            sections={CONFIGURAVEL}
            savedHiddenFields={saved.hiddenFields}
            savedRequiredOverrides={saved.requiredOverrides}
            previewHiddenFields={preview_.hiddenFields}
            previewRequiredOverrides={preview_.requiredOverrides}
            templates={templates}
            appliedTemplateId={appliedTemplate?.id ?? null}
            baseHref={`/${slug}/escolas/${id}/formulario`}
            isManagement={isManagement}
            cancelHref={`/${slug}/escolas/${id}`}
            salvarConfigAction={salvarConfig}
            salvarComoModeloAction={salvarComoModelo}
          />
        </form>
      </main>
    </>
  )
}
