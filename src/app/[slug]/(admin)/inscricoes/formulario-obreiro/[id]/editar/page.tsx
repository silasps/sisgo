import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getRolePreview } from '@/lib/role-preview'

type Props = { params: Promise<{ slug: string; id: string }> }

const SECTION_FIELDS: { key: string; title: string; fields: { label: string; name: string; type?: 'textarea' | 'select'; options?: string[] }[] }[] = [
  { key: 's1', title: 'E-mail', fields: [{ label: 'E-mail', name: 'email' }] },
  {
    key: 's2', title: 'Dados pessoais',
    fields: [
      { label: 'Nome completo', name: 'nome' },
      { label: 'Sexo', name: 'sexo', type: 'select', options: ['M', 'F'] },
      { label: 'Data de nascimento', name: 'data_nascimento' },
      { label: 'Estado civil', name: 'estado_civil', type: 'select', options: ['solteiro', 'casado', 'divorciado', 'viuvo'] },
      { label: 'Brasileiro(a)?', name: 'is_brasileiro', type: 'select', options: ['sim', 'nao'] },
      { label: 'Nacionalidade', name: 'nacionalidade' },
      { label: 'Escolaridade', name: 'escolaridade' },
      { label: 'Profissão', name: 'profissao' },
      { label: 'Habilidades', name: 'habilidades', type: 'textarea' },
      { label: 'RG', name: 'rg' },
      { label: 'CPF', name: 'cpf' },
      { label: 'Passaporte', name: 'passaporte' },
      { label: 'CEP', name: 'cep' },
      { label: 'Endereço', name: 'endereco' },
      { label: 'Bairro', name: 'bairro' },
      { label: 'Cidade', name: 'cidade' },
      { label: 'Estado', name: 'estado' },
      { label: 'País', name: 'pais' },
      { label: 'Celular', name: 'celular' },
      { label: 'E-mail de contato', name: 'email_contato' },
      { label: 'Emergência — Nome', name: 'emergencia_nome' },
      { label: 'Emergência — Parentesco', name: 'emergencia_parentesco' },
      { label: 'Emergência — Telefone', name: 'emergencia_telefone' },
    ],
  },
  {
    key: 's3', title: 'Família',
    fields: [
      { label: 'Nome do cônjuge', name: 'conjuge_nome' },
      { label: 'Tem filhos?', name: 'tem_filhos', type: 'select', options: ['sim', 'nao'] },
      { label: 'Dados dos filhos', name: 'filhos_dados', type: 'textarea' },
    ],
  },
  {
    key: 's4', title: 'Igreja e vida espiritual',
    fields: [
      { label: 'Igreja', name: 'igreja_nome' },
      { label: 'Cidade da igreja', name: 'igreja_cidade' },
      { label: 'Tempo na igreja', name: 'tempo_igreja' },
      { label: 'Nome do pastor/líder', name: 'pastor_nome' },
      { label: 'Cargo', name: 'pastor_cargo' },
      { label: 'E-mail do pastor', name: 'pastor_email' },
      { label: 'Telefone do pastor', name: 'pastor_telefone' },
      { label: 'Conversou com o pastor?', name: 'conversou_pastor', type: 'select', options: ['sim', 'nao'] },
      { label: 'Igreja está ciente?', name: 'igreja_ciente', type: 'select', options: ['sim', 'nao', 'parcialmente'] },
    ],
  },
  {
    key: 's5', title: 'Experiência recente',
    fields: [
      { label: 'Tipo de experiência', name: 'experiencia_recente_tipo', type: 'select', options: ['escola', 'missao', 'nenhuma'] },
      { label: 'Nome da escola', name: 'escola_nome' },
      { label: 'Descrição do projeto missionário', name: 'missao_descricao', type: 'textarea' },
    ],
  },
  {
    key: 's6', title: 'Servir na base',
    fields: [
      { label: 'Modalidade', name: 'modalidade_servico', type: 'select', options: ['integral', 'parcial', 'temporario'] },
      { label: 'Tempo pretendido', name: 'tempo_servico' },
      { label: 'Data prevista de chegada', name: 'data_chegada' },
      { label: 'Motivação', name: 'motivacao', type: 'textarea' },
    ],
  },
  {
    key: 's7', title: 'Saúde',
    fields: [
      { label: 'Possui problema de saúde?', name: 'problema_saude', type: 'select', options: ['sim', 'nao'] },
      { label: 'Descrição do problema', name: 'problema_saude_descricao', type: 'textarea' },
      { label: 'Possui limitação física?', name: 'limitacao_fisica', type: 'select', options: ['sim', 'nao'] },
      { label: 'Descrição da limitação', name: 'limitacao_fisica_descricao', type: 'textarea' },
      { label: 'Toma remédio controlado?', name: 'remedio_controlado', type: 'select', options: ['sim', 'nao'] },
      { label: 'Descrição do remédio', name: 'remedio_controlado_descricao', type: 'textarea' },
    ],
  },
  {
    key: 's8', title: 'Questões jurídicas',
    fields: [
      { label: 'Possui pendência judicial?', name: 'pendencia_judicial', type: 'select', options: ['sim', 'nao'] },
      { label: 'Descrição da pendência', name: 'pendencia_judicial_descricao', type: 'textarea' },
    ],
  },
  {
    key: 's9', title: 'Finanças',
    fields: [
      { label: 'Possui apoio financeiro?', name: 'tem_apoio_financeiro', type: 'select', options: ['sim', 'parcialmente', 'nao'] },
      { label: 'Descrição do apoio', name: 'apoio_financeiro_descricao', type: 'textarea' },
      { label: 'Situação financeira atual', name: 'situacao_financeira', type: 'textarea' },
    ],
  },
]

function get(data: Record<string, unknown>, section: string, field: string): string {
  const sec = data[section] as Record<string, string> | undefined
  return sec?.[field] ?? ''
}

export default async function EditarFormularioObreiroPage({ params }: Props) {
  const { slug, id } = await params
  const supabase = await createClient()
  const sb = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)
  const memberships = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
  const superadminRow = memberships.find(r => r.roles?.name === 'superadmin')
  const currentOrgRow = memberships.find(r => r.organization_id === org.id)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  const preview = await getRolePreview(realRole)
  const userRole = preview?.role ?? realRole
  const allowed = ['superadmin', 'admin_base', 'lider_base', 'dh', 'lider_eted', 'lider_ministerio'].includes(userRole)
  if (!allowed) notFound()

  const { data: app } = await sb
    .from('staff_applications')
    .select('id, organization_id, form_data, people(full_name)')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()

  if (!app) notFound()

  const nomeCandidato = (app.people as unknown as { full_name?: string } | null)?.full_name ?? 'Obreiro'
  const formData = (app.form_data as Record<string, unknown>) ?? {}

  async function salvar(fd: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { createClient: createAuthClient } = await import('@/lib/supabase/server')
    const db = adm()
    const authClient = await createAuthClient()
    const { data: { user: actingUser } } = await authClient.auth.getUser()

    const updated: Record<string, Record<string, string>> = {}
    for (const [rawKey, rawVal] of fd.entries()) {
      if (!rawKey.includes('.')) continue
      const dot = rawKey.indexOf('.')
      const section = rawKey.slice(0, dot)
      const field = rawKey.slice(dot + 1)
      const val = (rawVal as string).trim()
      if (!updated[section]) updated[section] = {}
      updated[section][field] = val
    }

    const { data: current } = await db.from('staff_applications').select('form_data, status').eq('id', id).single()
    const existing = (current?.form_data as Record<string, unknown>) ?? {}

    const merged = { ...existing }
    for (const [section, fields] of Object.entries(updated)) {
      merged[section] = { ...(merged[section] as Record<string, string> ?? {}), ...fields }
    }

    // Só volta pra 'em_analise' se ainda estiver em andamento — uma
    // aprovação/reprovação já dada não é desfeita por uma correção de dados.
    const statusPatch = current?.status && ['enviado', 'em_analise'].includes(current.status)
      ? { status: 'em_analise' }
      : {}

    await db.from('staff_applications')
      .update({ form_data: merged, edited_by: actingUser?.id ?? null, edited_at: new Date().toISOString(), ...statusPatch })
      .eq('id', id)

    redirect(`/${slug}/inscricoes/formulario-obreiro/${id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <Link href={`/${slug}/inscricoes/formulario-obreiro/${id}`} className="text-xs text-gray-400 hover:text-gray-600">
            ← Voltar ao formulário
          </Link>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">Editar formulário — {nomeCandidato}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <form action={salvar} className="space-y-6">
          {SECTION_FIELDS.map(section => (
            <div key={section.key} className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-4">{section.title}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {section.fields.map(field => (
                  <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea name={`${section.key}.${field.name}`} defaultValue={get(formData, section.key, field.name)} rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    ) : field.type === 'select' ? (
                      <select name={`${section.key}.${field.name}`} defaultValue={get(formData, section.key, field.name)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                        <option value="">—</option>
                        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input name={`${section.key}.${field.name}`} defaultValue={get(formData, section.key, field.name)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button type="submit"
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-colors">
            Salvar correções
          </button>
        </form>
      </main>
    </div>
  )
}
