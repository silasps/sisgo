import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getRolePreview } from '@/lib/role-preview'

type Props = { params: Promise<{ slug: string; id: string }> }

// Seções e campos — mesmo mapeamento do viewer
const SECTION_FIELDS: { key: string; title: string; fields: { label: string; name: string; type?: 'textarea' | 'select'; options?: string[] }[] }[] = [
  {
    key: 's1', title: 'Identificação inicial',
    fields: [{ label: 'E-mail', name: 'email' }],
  },
  {
    key: 's4', title: 'Escola de interesse',
    fields: [
      { label: 'Escola', name: 'escola' },
      { label: 'Turma', name: 'turma' },
      { label: 'Como conheceu', name: 'como_conheceu' },
      { label: 'Como conheceu a JOCUM', name: 'como_conheceu_jocum' },
      { label: 'Conversou com alguém da escola?', name: 'conversou_equipe', type: 'select', options: ['sim', 'nao'] },
      { label: 'Com quem conversou', name: 'conversou_com_quem' },
      { label: 'Motivação', name: 'motivacao', type: 'textarea' },
    ],
  },
  {
    key: 's5', title: 'Informações pessoais',
    fields: [
      { label: 'Nome completo', name: 'nome' },
      { label: 'Sexo', name: 'sexo', type: 'select', options: ['M', 'F'] },
      { label: 'Data de nascimento', name: 'data_nascimento' },
      { label: 'Estado civil', name: 'estado_civil', type: 'select', options: ['solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel'] },
      { label: 'Brasileiro(a)?', name: 'is_brasileiro', type: 'select', options: ['sim', 'nao'] },
      { label: 'Formação', name: 'formacao' },
      { label: 'Estudando atualmente?', name: 'estudando', type: 'select', options: ['sim', 'nao'] },
      { label: 'Profissão', name: 'profissao' },
      { label: 'Trabalha atualmente?', name: 'trabalha', type: 'select', options: ['sim', 'nao'] },
      { label: 'Experiências', name: 'experiencias', type: 'textarea' },
      { label: 'Habilidades', name: 'habilidades', type: 'textarea' },
      { label: 'Português', name: 'idioma_português', type: 'select', options: ['nativo', 'avancado', 'intermediario', 'basico'] },
      { label: 'Inglês', name: 'idioma_inglês', type: 'select', options: ['nativo', 'avancado', 'intermediario', 'basico', ''] },
      { label: 'Espanhol', name: 'idioma_espanhol', type: 'select', options: ['nativo', 'avancado', 'intermediario', 'basico', ''] },
      { label: 'Outro idioma', name: 'outro_idioma' },
      { label: 'RG', name: 'rg' },
      { label: 'CPF', name: 'cpf' },
      { label: 'Passaporte', name: 'passaporte' },
      { label: 'Serviço militar', name: 'servico_militar', type: 'select', options: ['sim', 'nao'] },
      { label: 'CEP', name: 'cep' },
      { label: 'Endereço', name: 'endereco' },
      { label: 'Bairro', name: 'bairro' },
      { label: 'Cidade', name: 'cidade' },
      { label: 'Estado', name: 'estado' },
      { label: 'País', name: 'pais' },
      { label: 'E-mail de contato', name: 'email_contato' },
      { label: 'Celular', name: 'celular' },
      { label: 'Instagram', name: 'instagram' },
      { label: 'Facebook', name: 'facebook' },
      { label: 'LinkedIn', name: 'linkedin' },
      { label: 'Emergência — Nome', name: 'emergencia_nome' },
      { label: 'Emergência — Parentesco', name: 'emergencia_parentesco' },
      { label: 'Emergência — Telefone', name: 'emergencia_telefone' },
      { label: 'Emergência — E-mail', name: 'emergencia_email' },
      { label: 'Emergência — Cidade', name: 'emergencia_cidade' },
    ],
  },
  {
    key: 's6', title: 'Histórico pessoal',
    fields: [
      { label: 'Sobre você', name: 'sobre_voce', type: 'textarea' },
      { label: 'Processo de decisão', name: 'processo_decisao', type: 'textarea' },
      { label: 'Expectativas', name: 'expectativas', type: 'textarea' },
      { label: 'Motivações', name: 'motivacoes', type: 'textarea' },
      { label: 'Responsabilidades', name: 'responsabilidades', type: 'textarea' },
    ],
  },
  {
    key: 's7', title: 'Informações familiares',
    fields: [
      { label: 'Nome do pai', name: 'nome_pai' },
      { label: 'Nome da mãe', name: 'nome_mae' },
      { label: 'Pais cristãos?', name: 'pais_cristaos', type: 'select', options: ['ambos', 'pai', 'mae', 'nenhum'] },
      { label: 'Família apoia?', name: 'familia_apoia', type: 'select', options: ['sim', 'nao', 'parcialmente'] },
      { label: 'Situação familiar', name: 'situacao_familiar', type: 'textarea' },
      { label: 'Estado civil atual', name: 'estado_civil_atual' },
      { label: 'Tem filhos?', name: 'tem_filhos', type: 'select', options: ['sim', 'nao'] },
      { label: 'Dados dos filhos', name: 'filhos_dados', type: 'textarea' },
      { label: 'Filhos virão?', name: 'filhos_virao', type: 'select', options: ['sim', 'nao'] },
      { label: 'Com quem os filhos ficarão', name: 'filhos_ficam_com' },
    ],
  },
  {
    key: 's8', title: 'Igreja e ministério',
    fields: [
      { label: 'Igreja', name: 'igreja_nome' },
      { label: 'Cidade da igreja', name: 'igreja_cidade' },
      { label: 'Tempo na igreja', name: 'tempo_igreja' },
      { label: 'Membro oficial?', name: 'membro_oficial', type: 'select', options: ['sim', 'nao'] },
      { label: 'Participa de ministério?', name: 'tem_ministerio', type: 'select', options: ['sim', 'nao'] },
      { label: 'Qual ministério', name: 'ministerio_qual' },
      { label: 'Tempo no ministério', name: 'ministerio_tempo' },
      { label: 'Tem liderança?', name: 'tem_lideranca', type: 'select', options: ['sim', 'nao'] },
      { label: 'Cargo de liderança', name: 'lideranca_cargo' },
      { label: 'Responsabilidades na igreja', name: 'responsabilidades_igreja', type: 'textarea' },
      { label: 'Conversou com o pastor?', name: 'conversou_pastor', type: 'select', options: ['sim', 'nao'] },
      { label: 'Pastor concorda?', name: 'pastor_concorda', type: 'select', options: ['sim', 'nao'] },
      { label: 'Nome do pastor', name: 'pastor_nome' },
      { label: 'Cargo do pastor', name: 'pastor_cargo' },
      { label: 'E-mail do pastor', name: 'pastor_email' },
      { label: 'Telefone do pastor', name: 'pastor_telefone' },
    ],
  },
  {
    key: 's9', title: 'Referência de um Amigo',
    fields: [
      { label: 'Nome', name: 'ref_nome' },
      { label: 'Como se conheceram', name: 'ref_relacionamento' },
      { label: 'Tempo de amizade', name: 'ref_tempo' },
      { label: 'É cristã?', name: 'ref_crista', type: 'select', options: ['sim', 'nao'] },
      { label: 'E-mail', name: 'ref_email' },
      { label: 'Telefone', name: 'ref_telefone' },
    ],
  },
  {
    key: 's10', title: 'Histórico com organizações',
    fields: [
      { label: 'Participou de escola/projeto?', name: 'teve_historico', type: 'select', options: ['sim', 'nao'] },
      { label: 'Qual escola/projeto', name: 'hist_qual' },
      { label: 'Organização/base', name: 'hist_org' },
      { label: 'Duração', name: 'hist_duracao' },
      { label: 'Quando', name: 'hist_quando' },
      { label: 'Líder responsável', name: 'hist_lider_nome' },
      { label: 'E-mail do líder', name: 'hist_lider_email' },
      { label: 'Telefone do líder', name: 'hist_lider_tel' },
    ],
  },
  {
    key: 's11', title: 'Espiritual e emocional',
    fields: [
      { label: 'Tempo convertido(a)', name: 'tempo_convertido' },
      { label: 'Experiência de conversão', name: 'conversao', type: 'textarea' },
      { label: 'Vida com Deus atualmente', name: 'vida_deus', type: 'textarea' },
      { label: 'Rotina devocional', name: 'devocional', type: 'textarea' },
      { label: 'Crescimento espiritual', name: 'crescimento_espiritual', type: 'textarea' },
      { label: 'Chamado missionário?', name: 'chamado', type: 'select', options: ['sim', 'nao'] },
      { label: 'Descrição do chamado', name: 'chamado_descricao', type: 'textarea' },
      { label: 'Visão de missões', name: 'visao_missoes', type: 'textarea' },
      { label: 'Acompanhamento psicológico?', name: 'psicologico', type: 'select', options: ['nao', 'sim_faz', 'sim_fez'] },
      { label: 'Diagnóstico/situação emocional', name: 'diagnostico_emocional', type: 'textarea' },
      { label: 'Aberto a acomp. pastoral?', name: 'acompanhamento_pastoral', type: 'select', options: ['sim', 'nao'] },
      { label: 'Casa de recuperação?', name: 'recuperacao', type: 'select', options: ['sim', 'nao'] },
      { label: 'Detalhes da recuperação', name: 'recuperacao_detalhes', type: 'textarea' },
      { label: 'Condição atual (recuperação)', name: 'recuperacao_hoje', type: 'textarea' },
    ],
  },
  {
    key: 's12', title: 'Saúde física',
    fields: [
      { label: 'Problemas de saúde', name: 'saude_geral', type: 'textarea' },
      { label: 'Alergias', name: 'alergias' },
      { label: 'Restrição alimentar', name: 'restricao_alimentar' },
      { label: 'Limitação física', name: 'limitacao_fisica' },
      { label: 'Cirurgias', name: 'cirurgias' },
      { label: 'Usa medicamento contínuo?', name: 'usa_medicamento', type: 'select', options: ['sim', 'nao'] },
      { label: 'Medicamento', name: 'med_nome' },
      { label: 'Motivo/diagnóstico', name: 'med_motivo' },
      { label: 'Dosagem', name: 'med_dosagem' },
      { label: 'Possui receita?', name: 'med_receita', type: 'select', options: ['sim', 'nao'] },
      { label: 'Plano de saúde?', name: 'plano_saude', type: 'select', options: ['sim', 'nao'] },
      { label: 'Qual plano', name: 'plano_saude_qual' },
      { label: 'Orientações de emergência médica', name: 'emergencia_medica', type: 'textarea' },
    ],
  },
  {
    key: 's13', title: 'Questões legais',
    fields: [
      { label: 'Antecedente criminal?', name: 'antecedente', type: 'select', options: ['sim', 'nao'] },
      { label: 'Descrição do antecedente', name: 'antecedente_descricao', type: 'textarea' },
      { label: 'Pendência jurídica?', name: 'pendencia_juridica', type: 'select', options: ['sim', 'nao'] },
      { label: 'Restrição legal?', name: 'restricao_legal', type: 'select', options: ['sim', 'nao'] },
    ],
  },
  {
    key: 's14', title: 'Financeiro',
    fields: [
      { label: 'Tipo de apoio', name: 'apoio_tipo', type: 'select', options: ['proprio', 'igreja', 'familia', 'misto'] },
      { label: 'Igreja ajudará?', name: 'ajuda_igreja', type: 'select', options: ['sim', 'nao'] },
      { label: 'Consegue pagar tudo?', name: 'pagar_tudo', type: 'select', options: ['sim', 'nao'] },
      { label: 'Levantará mantenedores?', name: 'mantenedores', type: 'select', options: ['sim_ja_iniciou', 'sim_ainda_nao', 'nao'] },
      { label: 'Situação financeira', name: 'situacao_financeira', type: 'textarea' },
      { label: 'Possui dívidas?', name: 'dividas', type: 'select', options: ['sim', 'nao'] },
    ],
  },
]

const AUTOAVAL_AREAS = [
  'liderança', 'obediência', 'vida_devocional', 'facilidade_de_aprender', 'maturidade_pessoal',
  'trabalho_em_equipe', 'habilidade_para_falar_em_público', 'comunicação', 'organização',
  'pontualidade', 'flexibilidade', 'relacionamento_com_autoridade',
  'resolução_de_conflitos', 'capacidade_de_lidar_com_pressão', 'comportamento_em_situações_difíceis',
]
const AUTOAVAL_LABELS: Record<string, string> = {
  liderança: 'Liderança', obediência: 'Obediência', vida_devocional: 'Vida devocional',
  facilidade_de_aprender: 'Facilidade de aprender', maturidade_pessoal: 'Maturidade pessoal',
  trabalho_em_equipe: 'Trabalho em equipe', 'habilidade_para_falar_em_público': 'Habilidade para falar em público',
  comunicação: 'Comunicação', organização: 'Organização', pontualidade: 'Pontualidade',
  flexibilidade: 'Flexibilidade', 'relacionamento_com_autoridade': 'Relacionamento com autoridade',
  'resolução_de_conflitos': 'Resolução de conflitos', 'capacidade_de_lidar_com_pressão': 'Capacidade de lidar com pressão',
  'comportamento_em_situações_difíceis': 'Comportamento em situações difíceis',
}

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white'
const textareaCls = `${inputCls} resize-none`

export default async function FormularioEditorPage({ params }: Props) {
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
  if (!['superadmin', 'admin_base', 'lider_base', 'dh', 'lider_eted'].includes(userRole)) notFound()

  const { data: app } = await sb
    .from('school_applications')
    .select('id, status, form_data, organization_id, school_interest_forms(full_name)')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()
  if (!app) notFound()

  const formData = (app.form_data as Record<string, Record<string, string>>) ?? {}
  const preform = app.school_interest_forms as unknown as { full_name?: string } | null
  const nomeCandidato = formData.s5?.nome ?? preform?.full_name ?? '—'

  function get(section: string, field: string) {
    return formData[section]?.[field] ?? ''
  }

  async function salvar(fd: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const { createClient: createAuthClient } = await import('@/lib/supabase/server')
    const db = adm()
    const authClient = await createAuthClient()
    const { data: { user: actingUser } } = await authClient.auth.getUser()

    // Reconstrói o form_data a partir dos inputs name="sX.campo"
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

    // Preserva seções que não aparecem no editor (s2, s3, s15, s16, prefill…)
    const { data: current } = await db
      .from('school_applications')
      .select('form_data, status')
      .eq('id', id)
      .single()
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

    await db.from('school_applications')
      .update({ form_data: merged, edited_by: actingUser?.id ?? null, edited_at: new Date().toISOString(), ...statusPatch })
      .eq('id', id)

    redirect(`/${slug}/inscricoes/formulario/${id}`)
  }

  return (
    <>
      {/* Header */}
      <div className="h-16 shrink-0 sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center">
        <div className="flex items-center justify-between gap-3 flex-wrap w-full">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href={`/${slug}/inscricoes/formulario/${id}`}
              className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
              ← Voltar
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900 truncate">{nomeCandidato}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
              Modo edição
            </span>
          </div>
        </div>
      </div>

      <main className="p-4 md:p-6 max-w-3xl mx-auto">
        <form action={salvar} className="space-y-4">

          {SECTION_FIELDS.map(section => (
            <details key={section.key} className="group bg-white rounded-xl border border-gray-200 overflow-hidden" open>
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50">
                <h3 className="font-semibold text-gray-900 text-sm">{section.title}</h3>
                <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="px-5 pb-5 border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.fields.map(field => (
                  <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        name={`${section.key}.${field.name}`}
                        defaultValue={get(section.key, field.name)}
                        rows={3}
                        className={textareaCls}
                      />
                    ) : field.type === 'select' && field.options ? (
                      <select
                        name={`${section.key}.${field.name}`}
                        defaultValue={get(section.key, field.name)}
                        className={inputCls}
                      >
                        <option value="">—</option>
                        {field.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        name={`${section.key}.${field.name}`}
                        defaultValue={get(section.key, field.name)}
                        className={inputCls}
                      />
                    )}
                  </div>
                ))}
              </div>
            </details>
          ))}

          {/* Autoavaliação */}
          <details className="group bg-white rounded-xl border border-gray-200 overflow-hidden" open>
            <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50">
              <h3 className="font-semibold text-gray-900 text-sm">Autoavaliação</h3>
              <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="px-5 pb-5 border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AUTOAVAL_AREAS.map(area => (
                <div key={area}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{AUTOAVAL_LABELS[area]}</label>
                  <select
                    name={`s11.autoaval_${area}`}
                    defaultValue={get('s11', `autoaval_${area}`)}
                    className={inputCls}
                  >
                    <option value="">—</option>
                    <option value="otimo">Ótimo</option>
                    <option value="bom">Bom</option>
                    <option value="regular">Regular</option>
                    <option value="melhorar">Melhorar</option>
                  </select>
                </div>
              ))}
            </div>
          </details>

          {/* Botões */}
          <div className="flex gap-3 pt-2 pb-8">
            <Link href={`/${slug}/inscricoes/formulario/${id}`}
              className="flex-1 text-center px-4 py-3 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium">
              Cancelar
            </Link>
            <button type="submit"
              className="flex-1 px-4 py-3 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors">
              Salvar formulário
            </button>
          </div>

        </form>
      </main>
    </>
  )
}
