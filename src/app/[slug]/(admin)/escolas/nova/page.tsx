import { Header } from '@/components/layout/Header'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { SCHOOL_TYPES } from '@/lib/schools'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { canCreateSchool } from '@/lib/auth/school-access'
import { SubmitButton } from '@/components/ui/SubmitButton'

type Props = { params: Promise<{ slug: string }> }

export default async function NovaEscolaPage({ params }: Props) {
  const { slug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!(await canCreateSchool(supabase, user.id, org.id, role))) redirect(`/${slug}/escolas`)

  // Nomes de tipo já usados nessa organização — vira sugestão (datalist) no
  // campo abaixo, pra não perder o nome digitado numa escola anterior.
  const { data: typeNameRows } = await supabase.from('schools').select('type_name').eq('organization_id', org.id)
  const existingTypeNames = [...new Set((typeNameRows ?? []).map(r => r.type_name).filter(Boolean))].sort()

  async function createSchool(formData: FormData) {
    'use server'
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const { getCurrentOrganizationRole: getRole } = await import('@/lib/auth/org-role')
    const { isManagementRole: isMgmt } = await import('@/lib/auth/permissions')
    const { canCreateSchool: canCreate } = await import('@/lib/auth/school-access')
    const { createAdminClient } = await import('@/lib/supabase/admin')

    const authClient = await createServerClient()
    const { data: { user: actionUser } } = await authClient.auth.getUser()
    if (!actionUser) return

    const sb = createAdminClient()
    const { data: orgRow } = await sb.from('organizations').select('id').eq('slug', slug).single()
    if (!orgRow) return

    const { role: actionRole } = await getRole(authClient, actionUser.id, orgRow.id)
    const isManagementCreator = isMgmt(actionRole)
    if (!isManagementCreator && !(await canCreate(authClient, actionUser.id, orgRow.id, actionRole))) return

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
      type_name: (formData.get('type_name') as string)?.trim() || 'Escola',
      subtitle: (formData.get('subtitle') as string)?.trim() || null,
      form_config: formConfig,
      active: true,
    }).select('id').single()

    if (error) console.error('createSchool', error)
    if (!escola) return

    // Delegado (não-gestão) que cria a escola precisa continuar acessando
    // ela depois — sem isso, a própria página da escola bloqueia quem não é
    // gestão e não lidera aquela escola especificamente (ver escolas/[id]/
    // layout.tsx). Gestão já acessa tudo, não precisa disso.
    if (!isManagementCreator) {
      await sb.from('school_leaders').insert({ organization_id: orgRow.id, school_id: escola.id, user_id: actionUser.id })
    }

    redirect(`/${slug}/escolas/${escola.id}`)
  }

  return (
    <>
      <Header title="Nova escola" />
      <main className="p-4 md:p-6">
        <form action={createSchool} className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg mx-auto space-y-4">
          <p className="text-sm text-gray-500">Preencha os dados básicos para criar a escola. Você poderá editar todos os detalhes na próxima etapa.</p>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome da escola *</label>
            <input name="name" required placeholder="Ex: Escola de Treinamento e Discipulado"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
            <select name="school_type" defaultValue="eted"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              {SCHOOL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Define o formato do formulário de inscrição — não aparece pro candidato.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome do tipo *</label>
            <input name="type_name" required list="type-name-suggestions" placeholder="Ex: ETED, Curso Técnico, Pós-graduação..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <datalist id="type-name-suggestions">
              {existingTypeNames.map(name => <option key={name} value={name} />)}
            </datalist>
            <p className="text-[11px] text-gray-400 mt-1">Como esse tipo de escola é chamado — aparece nos cards e na página pública.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Descrição rápida</label>
            <input name="subtitle" placeholder="Uma frase que resume o propósito da escola"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href={`/${slug}/escolas`}
              className="px-5 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </Link>
            <SubmitButton
              pendingText="Criando…"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
              Criar e editar →
            </SubmitButton>
          </div>
        </form>
      </main>
    </>
  )
}
