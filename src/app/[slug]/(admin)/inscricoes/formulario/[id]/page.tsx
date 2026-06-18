import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getRolePreview } from '@/lib/role-preview'
import { ReferenceModal } from './ReferenceModal'
import { Pencil, FileText } from 'lucide-react'

type Props = { params: Promise<{ slug: string; id: string }> }

type FormSection = { title: string; fields: { label: string; key: string; type?: 'textarea' | 'radio' }[] }

const SECTIONS: FormSection[] = [
  {
    title: 'Identificação inicial',
    fields: [{ label: 'E-mail', key: 'email' }],
  },
  {
    title: 'Escola de interesse',
    fields: [
      { label: 'Escola', key: 'escola' },
      { label: 'Turma', key: 'turma' },
      { label: 'Como conheceu', key: 'como_conheceu' },
      { label: 'Como conheceu a JOCUM', key: 'como_conheceu_jocum' },
      { label: 'Conversou com alguém da escola?', key: 'conversou_equipe' },
      { label: 'Com quem conversou', key: 'conversou_com_quem' },
      { label: 'Motivação', key: 'motivacao', type: 'textarea' },
    ],
  },
  {
    title: 'Informações pessoais',
    fields: [
      { label: 'Nome completo', key: 'nome' },
      { label: 'Sexo', key: 'sexo' },
      { label: 'Nascimento', key: 'data_nascimento' },
      { label: 'Estado civil', key: 'estado_civil' },
      { label: 'Brasileiro(a)?', key: 'is_brasileiro' },
      { label: 'Nacionalidade', key: 'nacionalidade' },
      { label: 'Fluência em português', key: 'fluencia_portugues' },
      { label: 'Formação', key: 'formacao' },
      { label: 'Estudando atualmente?', key: 'estudando' },
      { label: 'Curso atual', key: 'curso_atual' },
      { label: 'Profissão', key: 'profissao' },
      { label: 'Trabalha atualmente?', key: 'trabalha' },
      { label: 'Experiências', key: 'experiencias', type: 'textarea' },
      { label: 'Habilidades', key: 'habilidades', type: 'textarea' },
      { label: 'Português', key: 'idioma_português' },
      { label: 'Inglês', key: 'idioma_inglês' },
      { label: 'Espanhol', key: 'idioma_espanhol' },
      { label: 'Outro idioma', key: 'outro_idioma' },
      { label: 'RG', key: 'rg' },
      { label: 'CPF', key: 'cpf' },
      { label: 'Passaporte', key: 'passaporte' },
      { label: 'Serviço militar', key: 'servico_militar' },
      { label: 'CEP', key: 'cep' },
      { label: 'Endereço', key: 'endereco' },
      { label: 'Bairro', key: 'bairro' },
      { label: 'Cidade', key: 'cidade' },
      { label: 'Estado', key: 'estado' },
      { label: 'País', key: 'pais' },
      { label: 'E-mail de contato', key: 'email_contato' },
      { label: 'Celular', key: 'celular' },
      { label: 'Instagram', key: 'instagram' },
      { label: 'Facebook', key: 'facebook' },
      { label: 'LinkedIn', key: 'linkedin' },
      { label: 'Outros links', key: 'outros_links' },
      { label: 'Emergência — Nome', key: 'emergencia_nome' },
      { label: 'Emergência — Parentesco', key: 'emergencia_parentesco' },
      { label: 'Emergência — Telefone', key: 'emergencia_telefone' },
      { label: 'Emergência — E-mail', key: 'emergencia_email' },
      { label: 'Emergência — Cidade', key: 'emergencia_cidade' },
    ],
  },
  {
    title: 'Histórico pessoal',
    fields: [
      { label: 'Sobre você', key: 'sobre_voce', type: 'textarea' },
      { label: 'Processo de decisão', key: 'processo_decisao', type: 'textarea' },
      { label: 'Expectativas', key: 'expectativas', type: 'textarea' },
      { label: 'Motivações', key: 'motivacoes', type: 'textarea' },
      { label: 'Responsabilidades', key: 'responsabilidades', type: 'textarea' },
    ],
  },
  {
    title: 'Informações familiares',
    fields: [
      { label: 'Nome do pai', key: 'nome_pai' },
      { label: 'Nome da mãe', key: 'nome_mae' },
      { label: 'Pais cristãos?', key: 'pais_cristaos' },
      { label: 'Família apoia?', key: 'familia_apoia' },
      { label: 'Situação familiar', key: 'situacao_familiar', type: 'textarea' },
      { label: 'Estado civil atual', key: 'estado_civil_atual' },
      { label: 'Nome/idade do cônjuge', key: 'conjuge_nome_idade' },
      { label: 'Tempo casados', key: 'tempo_casados' },
      { label: 'Cônjuge apoia?', key: 'conjuge_apoia' },
      { label: 'Cônjuge participará?', key: 'conjuge_participa' },
      { label: 'Tempo comprometido(a)', key: 'tempo_compromisso' },
      { label: 'Parceiro(a) apoia?', key: 'compromisso_apoia' },
      { label: 'Situação relacional', key: 'situacao_relacional', type: 'textarea' },
      { label: 'Tem filhos?', key: 'tem_filhos' },
      { label: 'Dados dos filhos', key: 'filhos_dados', type: 'textarea' },
      { label: 'Filhos virão?', key: 'filhos_virao' },
      { label: 'Com quem os filhos ficarão', key: 'filhos_ficam_com' },
    ],
  },
  {
    title: 'Igreja e ministério',
    fields: [
      { label: 'Igreja', key: 'igreja_nome' },
      { label: 'Cidade da igreja', key: 'igreja_cidade' },
      { label: 'Tempo na igreja', key: 'tempo_igreja' },
      { label: 'Membro oficial?', key: 'membro_oficial' },
      { label: 'Participa de ministério?', key: 'tem_ministerio' },
      { label: 'Qual ministério', key: 'ministerio_qual' },
      { label: 'Tempo no ministério', key: 'ministerio_tempo' },
      { label: 'Tem liderança?', key: 'tem_lideranca' },
      { label: 'Cargo de liderança', key: 'lideranca_cargo' },
      { label: 'Responsabilidades na igreja', key: 'responsabilidades_igreja', type: 'textarea' },
      { label: 'Conversou com o pastor?', key: 'conversou_pastor' },
      { label: 'Pastor concorda?', key: 'pastor_concorda' },
      { label: 'Nome do pastor', key: 'pastor_nome' },
      { label: 'Cargo do pastor', key: 'pastor_cargo' },
      { label: 'E-mail do pastor', key: 'pastor_email' },
      { label: 'Telefone do pastor', key: 'pastor_telefone' },
    ],
  },
  {
    title: 'Referência de um Amigo',
    fields: [
      { label: 'Nome', key: 'ref_nome' },
      { label: 'Como se conheceram', key: 'ref_relacionamento' },
      { label: 'Tempo de amizade', key: 'ref_tempo' },
      { label: 'É cristã?', key: 'ref_crista' },
      { label: 'E-mail', key: 'ref_email' },
      { label: 'Telefone', key: 'ref_telefone' },
    ],
  },
  {
    title: 'Histórico com organizações',
    fields: [
      { label: 'Participou de escola/projeto?', key: 'teve_historico' },
      { label: 'Qual escola/projeto', key: 'hist_qual' },
      { label: 'Organização/base', key: 'hist_org' },
      { label: 'Duração', key: 'hist_duracao' },
      { label: 'Quando', key: 'hist_quando' },
      { label: 'Líder responsável', key: 'hist_lider_nome' },
      { label: 'E-mail do líder', key: 'hist_lider_email' },
      { label: 'Telefone do líder', key: 'hist_lider_tel' },
    ],
  },
  {
    title: 'Espiritual e emocional',
    fields: [
      { label: 'Tempo convertido(a)', key: 'tempo_convertido' },
      { label: 'Experiência de conversão', key: 'conversao', type: 'textarea' },
      { label: 'Vida com Deus atualmente', key: 'vida_deus', type: 'textarea' },
      { label: 'Rotina devocional', key: 'devocional', type: 'textarea' },
      { label: 'Crescimento espiritual', key: 'crescimento_espiritual', type: 'textarea' },
      { label: 'Chamado missionário?', key: 'chamado' },
      { label: 'Descrição do chamado', key: 'chamado_descricao', type: 'textarea' },
      { label: 'Visão de missões', key: 'visao_missoes', type: 'textarea' },
      { label: 'Acompanhamento psicológico?', key: 'psicologico' },
      { label: 'Diagnóstico/situação emocional', key: 'diagnostico_emocional', type: 'textarea' },
      { label: 'Aberto a acomp. pastoral?', key: 'acompanhamento_pastoral' },
      { label: 'Casa de recuperação?', key: 'recuperacao' },
      { label: 'Detalhes da recuperação', key: 'recuperacao_detalhes' },
      { label: 'Condição atual (recuperação)', key: 'recuperacao_hoje', type: 'textarea' },
    ],
  },
  {
    title: 'Saúde física',
    fields: [
      { label: 'Problemas de saúde', key: 'saude_geral', type: 'textarea' },
      { label: 'Alergias', key: 'alergias' },
      { label: 'Restrição alimentar', key: 'restricao_alimentar' },
      { label: 'Limitação física', key: 'limitacao_fisica' },
      { label: 'Cirurgias', key: 'cirurgias' },
      { label: 'Usa medicamento contínuo?', key: 'usa_medicamento' },
      { label: 'Medicamento', key: 'med_nome' },
      { label: 'Motivo/diagnóstico', key: 'med_motivo' },
      { label: 'Dosagem', key: 'med_dosagem' },
      { label: 'Possui receita?', key: 'med_receita' },
      { label: 'Plano de saúde?', key: 'plano_saude' },
      { label: 'Qual plano', key: 'plano_saude_qual' },
      { label: 'Orientações de emergência médica', key: 'emergencia_medica', type: 'textarea' },
    ],
  },
  {
    title: 'Questões legais',
    fields: [
      { label: 'Antecedente criminal?', key: 'antecedente' },
      { label: 'Descrição do antecedente', key: 'antecedente_descricao', type: 'textarea' },
      { label: 'Pendência jurídica?', key: 'pendencia_juridica' },
      { label: 'Restrição legal?', key: 'restricao_legal' },
    ],
  },
  {
    title: 'Financeiro',
    fields: [
      { label: 'Tipo de apoio', key: 'apoio_tipo' },
      { label: 'Igreja ajudará?', key: 'ajuda_igreja' },
      { label: 'Consegue pagar tudo?', key: 'pagar_tudo' },
      { label: 'Levantará mantenedores?', key: 'mantenedores' },
      { label: 'Situação financeira', key: 'situacao_financeira', type: 'textarea' },
      { label: 'Possui dívidas?', key: 'dividas' },
    ],
  },
]

const AUTOAVAL_AREAS = [
  'Liderança', 'Obediência', 'Vida devocional', 'Facilidade de aprender', 'Maturidade pessoal',
  'Trabalho em equipe', 'Habilidade para falar em público', 'Comunicação', 'Organização',
  'Pontualidade', 'Flexibilidade', 'Relacionamento com autoridade',
  'Resolução de conflitos', 'Capacidade de lidar com pressão', 'Comportamento em situações difíceis',
]

const AVAL_COLORS: Record<string, string> = {
  otimo: 'bg-green-100 text-green-800',
  bom: 'bg-blue-100 text-blue-800',
  regular: 'bg-yellow-100 text-yellow-800',
  melhorar: 'bg-red-100 text-red-800',
}
const AVAL_LABELS: Record<string, string> = {
  otimo: 'Ótimo', bom: 'Bom', regular: 'Regular', melhorar: 'Melhorar',
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group bg-white rounded-xl border border-gray-200 overflow-hidden" open>
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="px-5 pb-5 border-t border-gray-100">
        {children}
      </div>
    </details>
  )
}

function FieldRow({ label, value, type }: { label: string; value: unknown; type?: 'textarea' | 'radio' }) {
  const str = typeof value === 'string' ? value.trim() : ''
  if (!str) return null
  return (
    <div className="py-2.5 border-b border-gray-50 last:border-0">
      <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
      {type === 'textarea'
        ? <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{str}</p>
        : <p className="text-sm text-gray-800">{str}</p>
      }
    </div>
  )
}


export default async function FormularioViewerPage({ params }: Props) {
  const { slug, id } = await params

  const supabase = await createClient()
  const sb = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()
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
  const allowed = ['superadmin', 'admin_base', 'lider_base', 'dh', 'lider_eted'].includes(userRole)
  if (!allowed) notFound()

  const { data: app } = await sb
    .from('school_applications')
    .select(`
      id, status, form_data, created_at,
      organization_id,
      schools(name),
      school_classes(name),
      school_interest_forms(full_name, email, phone)
    `)
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()

  if (!app) notFound()

  const formData = (app.form_data as Record<string, unknown>) ?? {}
  const isExterno = (formData as Record<string, unknown>).source === 'externo'
    || (Object.keys(formData).every(k => ['source', 'prefill'].includes(k)))
  const escola = app.schools as unknown as { name: string } | null
  const turma = app.school_classes as unknown as { name: string } | null
  const preform = app.school_interest_forms as unknown as { full_name?: string; email?: string; phone?: string } | null
  const nomeCandidato = (formData.s5 as Record<string, string> | undefined)?.nome ?? preform?.full_name ?? '—'

  // Busca formulários de referência
  const { data: refs } = await sb
    .from('reference_forms')
    .select('type, status, form_data')
    .eq('school_application_id', id)
    .order('created_at', { ascending: true })

  const pastorRef = refs?.find(r => r.type === 'pastor')
  const amigoRef = refs?.find(r => r.type === 'amigo')

  const STATUS_COLORS: Record<string, string> = {
    rascunho: 'bg-gray-100 text-gray-600',
    enviado: 'bg-blue-100 text-blue-700',
    em_analise: 'bg-indigo-100 text-indigo-700',
    aprovado: 'bg-green-100 text-green-700',
    reprovado: 'bg-red-100 text-red-700',
  }
  const STATUS_LABELS: Record<string, string> = {
    rascunho: 'Rascunho', enviado: 'Enviado', em_analise: 'Em análise',
    aprovado: 'Aprovado', reprovado: 'Reprovado',
  }

  return (
    <>
      {/* Header */}
      <div className="h-16 shrink-0 sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href={`/${slug}/inscricoes`}
            className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
            ← Inscrições
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900 truncate">{nomeCandidato}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {STATUS_LABELS[app.status] ?? app.status}
          </span>
        </div>
      </div>

      <main className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">

        {/* Info do candidato */}
        <div className="bg-indigo-600 text-white rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-1">
            {escola?.name ?? 'ETED'}{turma ? ` · ${turma.name}` : ''}
          </p>
          <h1 className="text-2xl font-black">{nomeCandidato}</h1>
          {preform?.email && <p className="text-indigo-100 text-sm mt-1">{preform.email}</p>}
          {preform?.phone && <p className="text-indigo-200 text-sm">{preform.phone}</p>}
          <p className="text-indigo-300 text-xs mt-2">
            Enviado em {new Date(app.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          <div className="mt-4 pt-4 border-t border-indigo-500">
            <Link
              href={`/${slug}/inscricoes/formulario/${id}/editar`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 font-semibold text-sm rounded-xl hover:bg-indigo-50 transition-colors"
            >
              <Pencil className="size-3.5 inline -mt-0.5" /> Preencher / editar formulário
            </Link>
            <p className="text-indigo-300 text-xs mt-1.5">Edite os campos diretamente aqui no sistema.</p>
          </div>
        </div>

        {/* Tabs: Candidato / Referências */}
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Formulário do candidato */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Formulário do Candidato</h2>

            {isExterno && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <FileText className="size-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Formulário recebido por outro meio</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Este candidato entregou o formulário preenchido fora do sistema (impresso, PDF ou outra plataforma).
                    Use o botão acima para digitar as respostas aqui.
                  </p>
                </div>
              </div>
            )}

            {/* Autoavaliação */}
            {!!formData.s11 && (
              <SectionCard title="Autoavaliação">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  {AUTOAVAL_AREAS.map(area => {
                    const key = `autoaval_${area.toLowerCase().replace(/\s/g, '_')}`
                    const val = (formData.s11 as Record<string, string>)?.[key]
                    if (!val) return null
                    return (
                      <div key={area} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-700">{area}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${AVAL_COLORS[val] ?? 'bg-gray-100 text-gray-500'}`}>
                          {AVAL_LABELS[val] ?? val}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            )}

            {/* Seções gerais */}
            {SECTIONS.map((section, i) => {
              const sectionKeys = ['s1', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's13', 's14']
              const sectionKey = sectionKeys[i] as keyof typeof formData
              const data = formData[sectionKey] as Record<string, string> | undefined
              if (!data) return null

              const visibleFields = section.fields.filter(f => {
                const val = data[f.key]
                return typeof val === 'string' && val.trim()
              })
              if (!visibleFields.length) return null

              return (
                <SectionCard key={section.title} title={section.title}>
                  <div className="mt-1">
                    {visibleFields.map(f => (
                      <FieldRow key={f.key} label={f.label} value={data[f.key]} type={f.type} />
                    ))}
                  </div>
                </SectionCard>
              )
            })}
          </div>

          {/* Painel lateral: referências */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Referências</h2>
            <ReferenceModal
              tipo="pastor"
              data={pastorRef?.form_data as Record<string, string> | null}
              status={(pastorRef?.status ?? 'pendente') as 'pendente' | 'enviado'}
              slug={slug}
              applicationId={id}
            />
            <ReferenceModal
              tipo="amigo"
              data={amigoRef?.form_data as Record<string, string> | null}
              status={(amigoRef?.status ?? 'pendente') as 'pendente' | 'enviado'}
              slug={slug}
              applicationId={id}
            />
          </div>
        </div>

      </main>
    </>
  )
}
