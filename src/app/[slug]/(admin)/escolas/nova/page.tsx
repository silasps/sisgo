import { Header } from '@/components/layout/Header'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { SCHOOL_TYPES } from '@/lib/schools'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { isManagementRole } from '@/lib/auth/permissions'

type Props = { params: Promise<{ slug: string }> }

export default async function NovaEscolaPage({ params }: Props) {
  const { slug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!isManagementRole(role)) redirect(`/${slug}/escolas`)

  async function createSchool(formData: FormData) {
    'use server'
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const { getCurrentOrganizationRole: getRole } = await import('@/lib/auth/org-role')
    const { isManagementRole: isMgmt } = await import('@/lib/auth/permissions')
    const { createAdminClient } = await import('@/lib/supabase/admin')

    const authClient = await createServerClient()
    const { data: { user: actionUser } } = await authClient.auth.getUser()
    if (!actionUser) return

    const sb = createAdminClient()
    const { data: orgRow } = await sb.from('organizations').select('id').eq('slug', slug).single()
    if (!orgRow) return

    const { role: actionRole } = await getRole(authClient, actionUser.id, orgRow.id)
    if (!isMgmt(actionRole)) return

    const schoolType = formData.get('school_type') as string

    // Seminário é bem mais curto que uma escola normal — já nasce com o
    // formulário enxuto: sem bloco de pastor, sem etapa de referência de
    // amigo, sem espiritual/emocional, legal ou financeiro (vetting de
    // longo prazo, não cabe num workshop de dias). Fica: identificação,
    // documentos, igreja (básico), histórico de outra base, saúde física.
    // O admin ainda pode reverter campo a campo em Configurar formulário.
    const formConfig = schoolType === 'seminario'
      ? { hidden_fields: ['s8.pastor_bloco', 's9.oculto', 's11.oculto', 's13.oculto', 's14.oculto'] }
      : {}

    const { data: escola, error } = await sb.from('schools').insert({
      organization_id: orgRow.id,
      name: formData.get('name') as string,
      school_type: schoolType,
      form_config: formConfig,
      active: true,
    }).select('id').single()

    if (error) console.error('createSchool', error)
    if (escola) redirect(`/${slug}/escolas/${escola.id}`)
  }

  return (
    <>
      <Header title="Nova escola" />
      <main className="p-4 md:p-6">
        <form action={createSchool} className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg space-y-4">
          <p className="text-sm text-gray-500">Preencha os dados básicos para criar a escola. Você poderá editar todos os detalhes na próxima etapa.</p>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome da escola *</label>
            <input name="name" required placeholder="Ex: Escola de Treinamento e Discipulado"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de escola</label>
            <select name="school_type" defaultValue="eted"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              {SCHOOL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href={`/${slug}/escolas`}
              className="px-5 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </Link>
            <button type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
              Criar e editar →
            </button>
          </div>
        </form>
      </main>
    </>
  )
}
