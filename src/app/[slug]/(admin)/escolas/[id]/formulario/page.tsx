'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getRolePreview } from '@/lib/role-preview'

type Props = { params: Promise<{ slug: string; id: string }> }

// Todos os campos configuráveis, agrupados por seção
const CONFIGURAVEL: { secao: string; key: string; titulo: string; campos: { name: string; label: string }[] }[] = [
  { secao: 's4', key: 'escola_interesse', titulo: 'Escola de interesse', campos: [
    { name: 'como_conheceu', label: 'Como conheceu a escola' },
    { name: 'como_conheceu_jocum', label: 'Como conheceu a JOCUM' },
    { name: 'conversou_equipe', label: 'Conversou com alguém da escola?' },
    { name: 'conversou_com_quem', label: 'Com quem conversou' },
    { name: 'motivacao', label: 'Motivação' },
  ]},
  { secao: 's5', key: 'dados_pessoais', titulo: 'Informações pessoais', campos: [
    { name: 'estado_civil', label: 'Estado civil' },
    { name: 'servico_militar', label: 'Serviço militar' },
    { name: 'passaporte', label: 'Passaporte' },
    { name: 'rg', label: 'RG' },
    { name: 'cpf', label: 'CPF' },
    { name: 'estudando', label: 'Estudando atualmente?' },
    { name: 'trabalha', label: 'Trabalha atualmente?' },
    { name: 'experiencias', label: 'Experiências profissionais' },
    { name: 'habilidades', label: 'Habilidades' },
    { name: 'instagram', label: 'Instagram' },
    { name: 'facebook', label: 'Facebook' },
    { name: 'linkedin', label: 'LinkedIn' },
    { name: 'outros_links', label: 'Outros links' },
  ]},
  { secao: 's6', key: 'historico_pessoal', titulo: 'Histórico pessoal', campos: [
    { name: 'sobre_voce', label: 'Sobre você' },
    { name: 'processo_decisao', label: 'Processo de decisão' },
    { name: 'expectativas', label: 'Expectativas' },
    { name: 'motivacoes', label: 'Motivações' },
    { name: 'responsabilidades', label: 'Responsabilidades assumidas' },
  ]},
  { secao: 's7', key: 'familia', titulo: 'Informações familiares', campos: [
    { name: 'situacao_familiar', label: 'Situação familiar' },
    { name: 'tem_filhos', label: 'Tem filhos?' },
    { name: 'filhos_dados', label: 'Dados dos filhos' },
    { name: 'filhos_virao', label: 'Filhos virão?' },
    { name: 'filhos_ficam_com', label: 'Com quem os filhos ficarão' },
  ]},
  { secao: 's8', key: 'igreja', titulo: 'Igreja e ministério', campos: [
    { name: 'tem_ministerio', label: 'Participa de ministério?' },
    { name: 'ministerio_qual', label: 'Qual ministério' },
    { name: 'ministerio_tempo', label: 'Tempo no ministério' },
    { name: 'tem_lideranca', label: 'Tem liderança?' },
    { name: 'lideranca_cargo', label: 'Cargo de liderança' },
    { name: 'responsabilidades_igreja', label: 'Responsabilidades na igreja' },
  ]},
  { secao: 's9', key: 'amigo', titulo: 'Referência de Amigo', campos: [
    { name: 'ref_nome', label: 'Nome do amigo' },
    { name: 'ref_relacionamento', label: 'Como se conheceram' },
    { name: 'ref_tempo', label: 'Tempo de amizade' },
    { name: 'ref_crista', label: 'É cristã?' },
    { name: 'ref_email', label: 'E-mail do amigo' },
    { name: 'ref_telefone', label: 'Telefone do amigo' },
  ]},
  { secao: 's10', key: 'historico_org', titulo: 'Histórico com organizações', campos: [
    { name: 'teve_historico', label: 'Participou de escola/projeto missionário?' },
    { name: 'hist_qual', label: 'Qual escola/projeto' },
    { name: 'hist_org', label: 'Organização/base' },
    { name: 'hist_duracao', label: 'Duração' },
    { name: 'hist_quando', label: 'Quando' },
    { name: 'hist_lider_nome', label: 'Líder responsável' },
    { name: 'hist_lider_email', label: 'E-mail do líder' },
    { name: 'hist_lider_tel', label: 'Telefone do líder' },
  ]},
  { secao: 's11', key: 'espiritual', titulo: 'Espiritual e emocional', campos: [
    { name: 'psicologico', label: 'Acompanhamento psicológico?' },
    { name: 'diagnostico_emocional', label: 'Diagnóstico/situação emocional' },
    { name: 'recuperacao', label: 'Casa de recuperação?' },
    { name: 'recuperacao_detalhes', label: 'Detalhes da recuperação' },
    { name: 'recuperacao_hoje', label: 'Condição atual (recuperação)' },
  ]},
  { secao: 's12', key: 'saude', titulo: 'Saúde física', campos: [
    { name: 'saude_geral', label: 'Problemas de saúde' },
    { name: 'alergias', label: 'Alergias' },
    { name: 'restricao_alimentar', label: 'Restrição alimentar' },
    { name: 'limitacao_fisica', label: 'Limitação física' },
    { name: 'cirurgias', label: 'Cirurgias' },
    { name: 'usa_medicamento', label: 'Usa medicamento contínuo?' },
    { name: 'plano_saude', label: 'Plano de saúde?' },
  ]},
  { secao: 's13', key: 'legal', titulo: 'Questões legais', campos: [
    { name: 'antecedente', label: 'Antecedente criminal?' },
    { name: 'pendencia_juridica', label: 'Pendência jurídica?' },
    { name: 'restricao_legal', label: 'Restrição legal?' },
  ]},
  { secao: 's14', key: 'financeiro', titulo: 'Financeiro', campos: [
    { name: 'apoio_tipo', label: 'Tipo de apoio financeiro' },
    { name: 'ajuda_igreja', label: 'Igreja ajudará financeiramente?' },
    { name: 'pagar_tudo', label: 'Consegue pagar tudo?' },
    { name: 'mantenedores', label: 'Levantará mantenedores?' },
    { name: 'situacao_financeira', label: 'Situação financeira' },
    { name: 'dividas', label: 'Possui dívidas?' },
  ]},
]

export default async function EscolaFormularioConfigPage({ params }: Props) {
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
    .eq('user_id', user.id).eq('active', true)
  const memberships = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
  const superadminRow = memberships.find(r => r.roles?.name === 'superadmin')
  const currentOrgRow = memberships.find(r => r.organization_id === org.id)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  const preview = await getRolePreview(realRole)
  const userRole = preview?.role ?? realRole
  if (!['superadmin', 'admin_base', 'lider_base', 'lider_eted'].includes(userRole)) notFound()

  const { data: school } = await sb
    .from('schools')
    .select('id, name, form_config')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()
  if (!school) notFound()

  const config = (school.form_config as { hidden_fields?: string[] }) ?? {}
  const hiddenFields = new Set<string>(config.hidden_fields ?? [])

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

    await db.from('schools')
      .update({ form_config: { hidden_fields: hiddenFields } })
      .eq('id', id)

    redirect(`/${slug}/escolas/${id}/formulario`)
  }

  const totalCampos = CONFIGURAVEL.reduce((acc, s) => acc + s.campos.length, 0)
  const totalAtivos = totalCampos - hiddenFields.size

  return (
    <>
      <div className="h-16 md:h-14 sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href={`/${slug}/escolas/${id}`} className="text-sm text-gray-500 hover:text-gray-800">
            ← {school.name}
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">Configurar formulário</span>
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

        <form action={salvarConfig} className="space-y-3">
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

          <div className="flex gap-3 pt-2 pb-8">
            <Link href={`/${slug}/escolas/${id}`}
              className="flex-1 text-center px-4 py-3 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium">
              Cancelar
            </Link>
            <button type="submit"
              className="flex-1 px-4 py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors">
              Salvar configuração
            </button>
          </div>
        </form>
      </main>
    </>
  )
}
