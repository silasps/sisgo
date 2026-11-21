import type { createAdminClient } from '@/lib/supabase/admin'

type Db = ReturnType<typeof createAdminClient>

export type FormConfig = {
  hidden_fields?: string[]
  payment_info?: string
  // Override de obrigatório/opcional por campo (chave "sX.campo" →
  // true=obrigatório, false=opcional). Ausência de chave = usa o default
  // já hardcoded no componente (ver requiredByDefault abaixo e
  // src/app/[slug]/formulario/[token]/FormularioInscricao.tsx).
  required_overrides?: Record<string, boolean>
}

export type FormTemplate = {
  id: string
  name: string
  form_config: FormConfig
  default_for_school_type: string | null
}

export type ConfigField = {
  name: string
  label: string
  // Explica pro admin o que a pergunta pede, já que o rótulo sozinho às
  // vezes não deixa claro (ex: "Sobre você" é uma seção, não um campo).
  description?: string
  // Default de obrigatório/opcional vindo do código do formulário
  // (duplica o `required` hardcoded em FormularioInscricao.tsx — mantenha
  // os dois sincronizados ao mexer num campo). Ausente = campo não tem
  // controle de obrigatoriedade (bloco inteiro, pseudo-campo "oculto" ou
  // sub-campo de lista repetível como filhos/histórico).
  requiredByDefault?: boolean
  // Puramente visual: indenta esse campo na lista de admin, pra mostrar
  // que ele só aparece no formulário condicionado a outro campo da mesma
  // seção (ex: filhos_dados só pergunta se filhos_virao = sim).
  indent?: boolean
}

// Todos os campos configuráveis do formulário de inscrição, agrupados por
// seção — usado tanto na tela de configurar formulário da escola quanto da
// turma. Campos fora dessa lista (ex: s1.nome, s15, s16) são sempre
// exibidos e não podem ser desativados.
export const CONFIGURAVEL: { secao: string; key: string; titulo: string; campos: ConfigField[] }[] = [
  { secao: 's3', key: 'termo_compromisso', titulo: 'Termo inicial de compromisso', campos: [
    { name: 'termo_1', label: '1. Responsabilidade financeira', description: 'Candidato declara estar ciente das responsabilidades financeiras da inscrição.' },
    { name: 'termo_2', label: '2. Concordância com pagamento dos valores', description: 'Candidato concorda em pagar os valores informados pela organização.' },
    { name: 'termo_3', label: '3. Sem estorno em caso de desistência/desligamento', description: 'Candidato está ciente de que valores já pagos podem não ser devolvidos.' },
    { name: 'termo_4', label: '4. Isenção de responsabilidade da organização por danos', description: 'Candidato isenta a organização por danos materiais/físicos, exceto o previsto em lei.' },
    { name: 'termo_5', label: '5. Submissão aos padrões e rotina da missão', description: 'Candidato concorda em seguir padrões, orientações e rotina do período.' },
    { name: 'termo_6', label: '6. Consentimento para atendimento médico de emergência', description: 'Candidato autoriza atendimento médico/cirurgia em caso de emergência.' },
    { name: 'termo_7', label: '7. Proibição de tabaco, álcool e drogas', description: 'Candidato está ciente de que esses itens não são permitidos durante o período.' },
    { name: 'termo_8', label: '8. Não compartilhar medicamentos', description: 'Candidato está ciente de que não deve compartilhar medicamentos de uso pessoal.' },
    { name: 'termo_9', label: '9. Relacionamentos amorosos sujeitos à orientação da liderança', description: 'Candidato está ciente de que relacionamentos iniciados no período podem ter orientação da liderança.' },
    { name: 'termo_10', label: '10. Declaração de veracidade das informações', description: 'Candidato declara que vai preencher o formulário com informações verdadeiras.' },
  ]},
  { secao: 's4', key: 'escola_interesse', titulo: 'Escola de interesse', campos: [
    { name: 'como_conheceu', label: 'Como conheceu a escola', description: 'Pergunta de múltipla escolha: indicação, redes sociais, site, evento, igreja ou outro.', requiredByDefault: true },
    { name: 'como_conheceu_jocum', label: 'Como conheceu a organização', description: 'Campo de texto livre sobre como conheceu a organização.', requiredByDefault: false },
    { name: 'conversou_equipe', label: 'Conversou com alguém da escola?', description: 'Pergunta sim/não se já falou com a equipe antes de se inscrever.', requiredByDefault: true },
    { name: 'conversou_com_quem', label: 'Com quem conversou', description: 'Campo de texto livre pra dizer com quem da equipe conversou.', requiredByDefault: false },
    { name: 'motivacao', label: 'Motivação', description: 'Texto livre: por que a pessoa quer participar.', requiredByDefault: true },
    { name: 'data_chegada', label: 'Data prevista de chegada', description: 'Data em que o candidato pretende chegar.', requiredByDefault: true },
    { name: 'horario_chegada', label: 'Horário previsto de chegada', description: 'Horário em que o candidato pretende chegar.', requiredByDefault: true },
    { name: 'data_saida', label: 'Data prevista de saída', description: 'Data em que o candidato pretende ir embora.', requiredByDefault: false },
    { name: 'horario_saida', label: 'Horário previsto de saída', description: 'Horário em que o candidato pretende ir embora.', requiredByDefault: false },
    { name: 'base_origem', label: 'De qual base vem', description: 'Texto livre: de qual base/cidade o candidato está vindo.', requiredByDefault: false },
    { name: 'meio_transporte', label: 'Meio de transporte', description: 'Texto livre: como o candidato vai chegar (carro, ônibus, avião etc.).', requiredByDefault: false },
    { name: 'necessidades_acomodacao', label: 'Necessidades especiais de acomodação', description: 'Texto livre pra pedidos especiais de acomodação.', requiredByDefault: false },
  ]},
  { secao: 's5', key: 'dados_pessoais', titulo: 'Informações pessoais', campos: [
    { name: 'estado_civil', label: 'Estado civil', description: 'Solteiro, casado, comprometido, divorciado ou viúvo.', requiredByDefault: true },
    { name: 'conjuge_nome', label: 'Nome do cônjuge (se casado)', description: 'Só aparece se o estado civil marcado for "casado".', requiredByDefault: false },
    { name: 'servico_militar', label: 'Serviço militar', description: 'Situação do candidato com o serviço militar (homens).', requiredByDefault: false },
    { name: 'passaporte', label: 'Passaporte', description: 'Número do passaporte — obrigatório por padrão só pra candidatos estrangeiros.', requiredByDefault: false },
    { name: 'rg', label: 'RG', description: 'Número do RG (sem máscara, aceita formatos variados por estado).', requiredByDefault: false },
    { name: 'cpf', label: 'CPF', description: 'Número do CPF, com validação de dígito verificador.', requiredByDefault: false },
    { name: 'estudando', label: 'Estudando atualmente?', description: 'Pergunta sim/não; se sim, pede o curso atual.', requiredByDefault: true },
    { name: 'trabalha', label: 'Trabalha atualmente?', description: 'Pergunta sim/não sobre trabalho atual.', requiredByDefault: true },
    { name: 'experiencias', label: 'Experiências profissionais', description: 'Texto livre sobre experiências de trabalho.', requiredByDefault: false },
    { name: 'habilidades', label: 'Habilidades', description: 'Texto livre sobre habilidades e competências.', requiredByDefault: false },
    { name: 'endereco_bloco', label: 'Endereço (bloco inteiro)', description: 'CEP, bairro, rua, cidade, estado e país — desativa o bloco todo de uma vez.' },
    { name: 'redes_bloco', label: 'Redes sociais (bloco inteiro)', description: 'Instagram, Facebook, TikTok, LinkedIn e outros links — desativa o bloco todo de uma vez.' },
  ]},
  { secao: 's6', key: 'historico_pessoal', titulo: 'Histórico pessoal', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'sobre_voce', label: 'Sobre você', description: 'Texto livre pro candidato se apresentar um pouco.', requiredByDefault: true },
    { name: 'processo_decisao', label: 'Processo de decisão', description: 'Texto livre: como o candidato chegou à decisão de se inscrever.', requiredByDefault: true },
    { name: 'expectativas', label: 'Expectativas', description: 'Texto livre: o que o candidato espera da experiência.', requiredByDefault: true },
    { name: 'motivacoes', label: 'Motivações', description: 'Texto livre: motivações pessoais pra participar.', requiredByDefault: true },
    { name: 'responsabilidades', label: 'Responsabilidades assumidas', description: 'Texto livre: compromissos que o candidato está deixando pra trás (trabalho, estudo etc.).', requiredByDefault: false },
  ]},
  { secao: 's7', key: 'familia', titulo: 'Informações familiares', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'nome_pai', label: 'Nome do pai', description: 'Texto livre com o nome do pai.', requiredByDefault: false },
    { name: 'nome_mae', label: 'Nome da mãe', description: 'Texto livre com o nome da mãe.', requiredByDefault: false },
    { name: 'pais_cristaos', label: 'Pais são cristãos?', description: 'Ambos, apenas um, ou nenhum.', requiredByDefault: false },
    { name: 'familia_apoia', label: 'Família apoia a participação?', description: 'Sim, parcialmente ou não.', requiredByDefault: true },
    { name: 'situacao_familiar', label: 'Situação familiar', description: 'Texto livre sobre a situação familiar do candidato.', requiredByDefault: false },
    { name: 'conjuge_nome_idade', label: 'Nome e idade do cônjuge', description: 'Só aparece se o estado civil for "casado".', requiredByDefault: false, indent: true },
    { name: 'data_casamento', label: 'Data do casamento', description: 'Só aparece se o estado civil for "casado".', requiredByDefault: false, indent: true },
    { name: 'conjuge_apoia', label: 'Cônjuge apoia a participação?', description: 'Só aparece se o estado civil for "casado".', requiredByDefault: false, indent: true },
    { name: 'conjuge_participa', label: 'Cônjuge também participará?', description: 'Só aparece se o estado civil for "casado".', requiredByDefault: false, indent: true },
    { name: 'tempo_compromisso', label: 'Tempo de compromisso', description: 'Só aparece se o estado civil for "comprometido".', requiredByDefault: false, indent: true },
    { name: 'compromisso_apoia', label: 'Compromisso apoia a participação?', description: 'Só aparece se o estado civil for "comprometido".', requiredByDefault: false, indent: true },
    { name: 'situacao_relacional', label: 'Situação relacional', description: 'Texto livre — só aparece se o estado civil for "comprometido".', requiredByDefault: false, indent: true },
    { name: 'tem_filhos', label: 'Tem filhos?', description: 'Pergunta sim/não — abre as perguntas abaixo se "sim".', requiredByDefault: false },
    { name: 'filhos_virao', label: 'Filhos virão?', description: 'Só aparece se "tem filhos" = sim. Se marcar "sim", libera automaticamente os dois campos abaixo.', requiredByDefault: false },
    { name: 'filhos_dados', label: 'Dados dos filhos', description: 'Nome, sexo e nascimento de cada filho — por padrão só é pedido se "filhos virão" = sim.', requiredByDefault: false, indent: true },
    { name: 'filhos_ficam_com', label: 'Com quem os filhos ficarão', description: 'Quem cuida dos filhos durante o período — por padrão só é pedido se "filhos virão" = sim.', requiredByDefault: false, indent: true },
  ]},
  { secao: 's8', key: 'igreja', titulo: 'Igreja e ministério', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'tem_ministerio', label: 'Participa de ministério?', description: 'Pergunta sim/não — abre as perguntas de ministério abaixo se "sim".', requiredByDefault: false },
    { name: 'ministerio_qual', label: 'Qual ministério', description: 'Só aparece se "participa de ministério" = sim.', requiredByDefault: false },
    { name: 'ministerio_tempo', label: 'Tempo no ministério', description: 'Só aparece se "participa de ministério" = sim.', requiredByDefault: false },
    { name: 'tem_lideranca', label: 'Tem liderança?', description: 'Só aparece se "participa de ministério" = sim.', requiredByDefault: false },
    { name: 'lideranca_cargo', label: 'Cargo de liderança', description: 'Só aparece se "tem liderança" = sim.', requiredByDefault: false },
    { name: 'responsabilidades_igreja', label: 'Responsabilidades na igreja', description: 'Texto livre sobre responsabilidades na igreja local.', requiredByDefault: false },
    { name: 'pastor_bloco', label: 'Referência de pastor (bloco inteiro)', description: 'Bloco de referência pastoral: nome, cargo, contato e se concorda com a inscrição — desativa tudo de uma vez.' },
  ]},
  { secao: 's9', key: 'amigo', titulo: 'Referência de Amigo', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'ref_nome', label: 'Nome do amigo', description: 'Nome completo da referência pessoal.', requiredByDefault: true },
    { name: 'ref_relacionamento', label: 'Como se conheceram', description: 'Texto livre sobre como se conheceram.', requiredByDefault: true },
    { name: 'ref_tempo', label: 'Tempo de amizade', description: 'Há quanto tempo se conhecem.', requiredByDefault: true },
    { name: 'ref_crista', label: 'É cristã?', description: 'Pergunta sim/não sobre a fé da referência.', requiredByDefault: false },
    { name: 'ref_email', label: 'E-mail do amigo', description: 'E-mail de contato da referência (recebe o link do formulário de referência).', requiredByDefault: true },
    { name: 'ref_telefone', label: 'Telefone do amigo', description: 'Telefone de contato da referência.', requiredByDefault: true },
  ]},
  { secao: 's10', key: 'historico_org', titulo: 'Histórico com organizações', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'teve_historico', label: 'Participou de escola/projeto missionário?', description: 'Pergunta sim/não — abre a lista de histórico abaixo se "sim".', requiredByDefault: true },
    { name: 'hist_qual', label: 'Qual escola/projeto', description: 'Campo dentro da lista de histórico com organizações.' },
    { name: 'hist_org', label: 'Organização/base', description: 'Campo dentro da lista de histórico com organizações.' },
    { name: 'hist_duracao', label: 'Duração', description: 'Campo dentro da lista de histórico com organizações.' },
    { name: 'hist_quando', label: 'Quando', description: 'Campo dentro da lista de histórico com organizações.' },
    { name: 'hist_lider_nome', label: 'Líder responsável', description: 'Campo dentro da lista de histórico com organizações.' },
    { name: 'hist_lider_email', label: 'E-mail do líder', description: 'Campo dentro da lista de histórico com organizações.' },
    { name: 'hist_lider_tel', label: 'Telefone do líder', description: 'Campo dentro da lista de histórico com organizações.' },
  ]},
  { secao: 's11', key: 'espiritual', titulo: 'Espiritual e emocional', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'psicologico', label: 'Acompanhamento psicológico?', description: 'Faz, já fez ou nunca fez acompanhamento psicológico.', requiredByDefault: true },
    { name: 'diagnostico_emocional', label: 'Diagnóstico/situação emocional', description: 'Só aparece se já fez ou faz acompanhamento psicológico.', requiredByDefault: false },
    { name: 'recuperacao', label: 'Casa de recuperação?', description: 'Pergunta sim/não sobre passagem por casa de recuperação.', requiredByDefault: false },
    { name: 'recuperacao_detalhes', label: 'Detalhes da recuperação', description: 'Só aparece se "casa de recuperação" = sim.', requiredByDefault: false },
    { name: 'recuperacao_hoje', label: 'Condição atual (recuperação)', description: 'Só aparece se "casa de recuperação" = sim.', requiredByDefault: false },
  ]},
  { secao: 's12', key: 'saude', titulo: 'Saúde física', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'saude_geral', label: 'Problemas de saúde', description: 'Texto livre sobre condições de saúde em geral.', requiredByDefault: false },
    { name: 'alergias', label: 'Alergias', description: 'Texto livre sobre alergias (alimentares, medicamentos etc.).', requiredByDefault: false },
    { name: 'restricao_alimentar', label: 'Restrição alimentar', description: 'Texto livre sobre restrições alimentares.', requiredByDefault: false },
    { name: 'limitacao_fisica', label: 'Limitação física', description: 'Texto livre sobre limitações físicas.', requiredByDefault: false },
    { name: 'cirurgias', label: 'Cirurgias', description: 'Texto livre sobre cirurgias já realizadas.', requiredByDefault: false },
    { name: 'usa_medicamento', label: 'Usa medicamento contínuo?', description: 'Pergunta sim/não — abre nome, motivo e dosagem se "sim".', requiredByDefault: true },
    { name: 'plano_saude', label: 'Plano de saúde?', description: 'Pergunta sim/não — abre qual plano se "sim".', requiredByDefault: false },
  ]},
  { secao: 's13', key: 'legal', titulo: 'Questões legais', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'antecedente', label: 'Antecedente criminal?', description: 'Pergunta sim/não — abre descrição se "sim".', requiredByDefault: true },
    { name: 'pendencia_juridica', label: 'Pendência jurídica?', description: 'Pergunta sim/não sobre processos ou pendências jurídicas.', requiredByDefault: true },
    { name: 'restricao_legal', label: 'Restrição legal?', description: 'Pergunta sim/não sobre outras restrições legais.', requiredByDefault: false },
  ]},
  { secao: 's14', key: 'financeiro', titulo: 'Financeiro', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'apoio_tipo', label: 'Tipo de apoio financeiro', description: 'Como o candidato vai se manter: próprio, família, igreja, mantenedores ou misto.', requiredByDefault: true },
    { name: 'ajuda_igreja', label: 'Igreja ajudará financeiramente?', description: 'Sim, não, ou "em conversa" sobre ajuda da igreja local.', requiredByDefault: false },
    { name: 'pagar_tudo', label: 'Consegue pagar tudo?', description: 'Sim, parcialmente ou não — capacidade de arcar com os custos.', requiredByDefault: true },
    { name: 'mantenedores', label: 'Levantará mantenedores?', description: 'Se já iniciou, vai iniciar, ou não vai levantar mantenedores.', requiredByDefault: false },
    { name: 'situacao_financeira', label: 'Situação financeira', description: 'Texto livre sobre a situação financeira atual.', requiredByDefault: true },
    { name: 'dividas', label: 'Possui dívidas?', description: 'Pergunta sim/não sobre dívidas em aberto.', requiredByDefault: false },
  ]},
]

// Resolve o config efetivo de uma turma: config próprio da turma (se
// existir, mesmo que hidden_fields seja []) vence sobre o default da
// escola — sem merge campo a campo. payment_info é sempre da escola.
// required_overrides segue a mesma regra de hidden_fields (turma inteira
// vence, sem merge).
export function resolveFormConfig(
  schoolConfig: FormConfig | null | undefined,
  classConfig: FormConfig | null | undefined,
): { hiddenFields: string[]; paymentInfo: string | null; requiredOverrides: Record<string, boolean> } {
  return {
    hiddenFields: classConfig?.hidden_fields ?? schoolConfig?.hidden_fields ?? [],
    paymentInfo: schoolConfig?.payment_info ?? null,
    requiredOverrides: classConfig?.required_overrides ?? schoolConfig?.required_overrides ?? {},
  }
}

export async function listFormTemplates(db: Db, organizationId: string): Promise<FormTemplate[]> {
  const { data } = await db
    .from('school_form_templates')
    .select('id, name, form_config, default_for_school_type')
    .eq('organization_id', organizationId)
    .order('name')
  return (data ?? []) as unknown as FormTemplate[]
}

export async function getDefaultTemplateForType(db: Db, organizationId: string, schoolType: string): Promise<FormTemplate | null> {
  const { data } = await db
    .from('school_form_templates')
    .select('id, name, form_config, default_for_school_type')
    .eq('organization_id', organizationId)
    .eq('default_for_school_type', schoolType)
    .maybeSingle()
  return (data as unknown as FormTemplate | null) ?? null
}
