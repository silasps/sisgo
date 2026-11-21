'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { isManagementRole } from '@/lib/auth/permissions'
import { getSchoolLink } from '@/lib/auth/unit-access'
import { CONFIGURAVEL, listFormTemplates } from '@/lib/school/formConfig'
import { SCHOOL_TYPES } from '@/lib/schools'

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

  const config = (school.form_config as { hidden_fields?: string[]; payment_info?: string }) ?? {}
  const paymentInfo = config.payment_info ?? ''

  const templates = await listFormTemplates(sb, org.id)
  const appliedTemplate = templateIdParam ? templates.find(t => t.id === templateIdParam) ?? null : null
  // Modelo aplicado via ?template= só muda a pré-visualização dos
  // checkboxes — nada é salvo até clicar em "Salvar configuração".
  const hiddenFields = new Set<string>(
    appliedTemplate ? (appliedTemplate.form_config.hidden_fields ?? []) : (config.hidden_fields ?? [])
  )

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

    await db.from('schools')
      .update({ form_config: { hidden_fields: hiddenFields, payment_info: paymentInfo } })
      .eq('id', id)

    redirect(`/${slug}/escolas/${id}/formulario`)
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
    if (!name) return
    const defaultForType = (fd.get('default_for_type') as string | null)?.trim() || null

    const todosOsCampos: string[] = []
    for (const secao of CONFIGURAVEL) {
      for (const campo of secao.campos) {
        todosOsCampos.push(`${secao.secao}.${campo.name}`)
      }
    }
    const hiddenFields = todosOsCampos.filter(key => fd.get(key) !== 'on')

    if (defaultForType) {
      await db.from('school_form_templates')
        .update({ default_for_school_type: null })
        .eq('organization_id', orgRow.id)
        .eq('default_for_school_type', defaultForType)
    }

    await db.from('school_form_templates')
      .upsert(
        { organization_id: orgRow.id, name, form_config: { hidden_fields: hiddenFields }, default_for_school_type: defaultForType, created_by: actionUser.id },
        { onConflict: 'organization_id,name' },
      )

    redirect(`/${slug}/escolas/${id}/formulario`)
  }

  const totalCampos = CONFIGURAVEL.reduce((acc, s) => acc + s.campos.length, 0)
  const totalAtivos = totalCampos - hiddenFields.size

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
            Desative os campos que não fazem parte do processo seletivo desta escola.
            Campos desativados não aparecem para o candidato.
          </p>
          <p className="text-indigo-200 text-xs mt-2">
            {totalAtivos} de {totalCampos} campos ativos
          </p>
        </div>

        {templates.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-3">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Começar de um modelo</h3>
            <p className="text-xs text-gray-400 mb-3">
              Só muda os campos abaixo pra você revisar — nada é salvo até clicar em &quot;Salvar configuração&quot;.
            </p>
            <div className="flex flex-wrap gap-2">
              {templates.map(t => (
                <Link key={t.id} href={`/${slug}/escolas/${id}/formulario?template=${t.id}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    appliedTemplate?.id === t.id
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}>
                  {t.name}
                </Link>
              ))}
            </div>
          </div>
        )}

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

          {CONFIGURAVEL.map(secao => {
            const ativos = secao.campos.filter(c => !hiddenFields.has(`${secao.secao}.${c.name}`)).length
            return (
              <details key={secao.key} className="group bg-white rounded-xl border border-gray-200 overflow-hidden" open>
                <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none list-none hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm">{secao.titulo}</h3>
                    <span className="text-xs text-gray-400">{ativos}/{secao.campos.length}</span>
                  </div>
                  <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {secao.campos.map(campo => {
                    const key = `${secao.secao}.${campo.name}`
                    const ativo = !hiddenFields.has(key)
                    return (
                      <label key={campo.name}
                        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                        <span className={`text-sm ${ativo ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                          {campo.label}
                        </span>
                        <input
                          type="checkbox"
                          name={key}
                          defaultChecked={ativo}
                          className="w-4 h-4 rounded accent-brand-500"
                        />
                      </label>
                    )
                  })}
                </div>
              </details>
            )
          })}

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
                <button type="submit" formAction={salvarComoModelo}
                  className="px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap">
                  Salvar como modelo…
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2 pb-8">
            <Link href={`/${slug}/escolas/${id}`}
              className="flex-1 text-center px-4 py-3 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium">
              Cancelar
            </Link>
            <button type="submit" formAction={salvarConfig}
              className="flex-1 px-4 py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors">
              Salvar configuração
            </button>
          </div>
        </form>
      </main>
    </>
  )
}
