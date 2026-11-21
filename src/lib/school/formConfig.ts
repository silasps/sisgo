import type { createAdminClient } from '@/lib/supabase/admin'

type Db = ReturnType<typeof createAdminClient>

export type FormConfig = { hidden_fields?: string[]; payment_info?: string }

export type FormTemplate = {
  id: string
  name: string
  form_config: FormConfig
  default_for_school_type: string | null
}

// Todos os campos configuráveis do formulário de inscrição, agrupados por
// seção — usado tanto na tela de configurar formulário da escola quanto da
// turma. Campos fora dessa lista (ex: s1.nome, s15, s16) são sempre
// exibidos e não podem ser desativados.
export const CONFIGURAVEL: { secao: string; key: string; titulo: string; campos: { name: string; label: string }[] }[] = [
  { secao: 's3', key: 'termo_compromisso', titulo: 'Termo inicial de compromisso', campos: [
    { name: 'termo_1', label: '1. Responsabilidade financeira' },
    { name: 'termo_2', label: '2. Concordância com pagamento dos valores' },
    { name: 'termo_3', label: '3. Sem estorno em caso de desistência/desligamento' },
    { name: 'termo_4', label: '4. Isenção de responsabilidade da organização por danos' },
    { name: 'termo_5', label: '5. Submissão aos padrões e rotina da missão' },
    { name: 'termo_6', label: '6. Consentimento para atendimento médico de emergência' },
    { name: 'termo_7', label: '7. Proibição de tabaco, álcool e drogas' },
    { name: 'termo_8', label: '8. Não compartilhar medicamentos' },
    { name: 'termo_9', label: '9. Relacionamentos amorosos sujeitos à orientação da liderança' },
    { name: 'termo_10', label: '10. Declaração de veracidade das informações' },
  ]},
  { secao: 's4', key: 'escola_interesse', titulo: 'Escola de interesse', campos: [
    { name: 'como_conheceu', label: 'Como conheceu a escola' },
    { name: 'como_conheceu_jocum', label: 'Como conheceu a organização' },
    { name: 'conversou_equipe', label: 'Conversou com alguém da escola?' },
    { name: 'conversou_com_quem', label: 'Com quem conversou' },
    { name: 'motivacao', label: 'Motivação' },
    { name: 'data_chegada', label: 'Data prevista de chegada' },
    { name: 'horario_chegada', label: 'Horário previsto de chegada' },
    { name: 'data_saida', label: 'Data prevista de saída' },
    { name: 'horario_saida', label: 'Horário previsto de saída' },
    { name: 'base_origem', label: 'De qual base vem' },
    { name: 'meio_transporte', label: 'Meio de transporte' },
    { name: 'necessidades_acomodacao', label: 'Necessidades especiais de acomodação' },
  ]},
  { secao: 's5', key: 'dados_pessoais', titulo: 'Informações pessoais', campos: [
    { name: 'estado_civil', label: 'Estado civil' },
    { name: 'conjuge_nome', label: 'Nome do cônjuge (se casado)' },
    { name: 'servico_militar', label: 'Serviço militar' },
    { name: 'passaporte', label: 'Passaporte' },
    { name: 'rg', label: 'RG' },
    { name: 'cpf', label: 'CPF' },
    { name: 'estudando', label: 'Estudando atualmente?' },
    { name: 'trabalha', label: 'Trabalha atualmente?' },
    { name: 'experiencias', label: 'Experiências profissionais' },
    { name: 'habilidades', label: 'Habilidades' },
    { name: 'endereco_bloco', label: 'Endereço (bloco inteiro)' },
    { name: 'redes_bloco', label: 'Redes sociais (bloco inteiro)' },
  ]},
  { secao: 's6', key: 'historico_pessoal', titulo: 'Histórico pessoal', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'sobre_voce', label: 'Sobre você' },
    { name: 'processo_decisao', label: 'Processo de decisão' },
    { name: 'expectativas', label: 'Expectativas' },
    { name: 'motivacoes', label: 'Motivações' },
    { name: 'responsabilidades', label: 'Responsabilidades assumidas' },
  ]},
  { secao: 's7', key: 'familia', titulo: 'Informações familiares', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'situacao_familiar', label: 'Situação familiar' },
    { name: 'tem_filhos', label: 'Tem filhos?' },
    { name: 'filhos_dados', label: 'Dados dos filhos' },
    { name: 'filhos_virao', label: 'Filhos virão?' },
    { name: 'filhos_ficam_com', label: 'Com quem os filhos ficarão' },
  ]},
  { secao: 's8', key: 'igreja', titulo: 'Igreja e ministério', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'tem_ministerio', label: 'Participa de ministério?' },
    { name: 'ministerio_qual', label: 'Qual ministério' },
    { name: 'ministerio_tempo', label: 'Tempo no ministério' },
    { name: 'tem_lideranca', label: 'Tem liderança?' },
    { name: 'lideranca_cargo', label: 'Cargo de liderança' },
    { name: 'responsabilidades_igreja', label: 'Responsabilidades na igreja' },
    { name: 'pastor_bloco', label: 'Referência de pastor (bloco inteiro)' },
  ]},
  { secao: 's9', key: 'amigo', titulo: 'Referência de Amigo', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'ref_nome', label: 'Nome do amigo' },
    { name: 'ref_relacionamento', label: 'Como se conheceram' },
    { name: 'ref_tempo', label: 'Tempo de amizade' },
    { name: 'ref_crista', label: 'É cristã?' },
    { name: 'ref_email', label: 'E-mail do amigo' },
    { name: 'ref_telefone', label: 'Telefone do amigo' },
  ]},
  { secao: 's10', key: 'historico_org', titulo: 'Histórico com organizações', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
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
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'psicologico', label: 'Acompanhamento psicológico?' },
    { name: 'diagnostico_emocional', label: 'Diagnóstico/situação emocional' },
    { name: 'recuperacao', label: 'Casa de recuperação?' },
    { name: 'recuperacao_detalhes', label: 'Detalhes da recuperação' },
    { name: 'recuperacao_hoje', label: 'Condição atual (recuperação)' },
  ]},
  { secao: 's12', key: 'saude', titulo: 'Saúde física', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'saude_geral', label: 'Problemas de saúde' },
    { name: 'alergias', label: 'Alergias' },
    { name: 'restricao_alimentar', label: 'Restrição alimentar' },
    { name: 'limitacao_fisica', label: 'Limitação física' },
    { name: 'cirurgias', label: 'Cirurgias' },
    { name: 'usa_medicamento', label: 'Usa medicamento contínuo?' },
    { name: 'plano_saude', label: 'Plano de saúde?' },
  ]},
  { secao: 's13', key: 'legal', titulo: 'Questões legais', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'antecedente', label: 'Antecedente criminal?' },
    { name: 'pendencia_juridica', label: 'Pendência jurídica?' },
    { name: 'restricao_legal', label: 'Restrição legal?' },
  ]},
  { secao: 's14', key: 'financeiro', titulo: 'Financeiro', campos: [
    { name: 'oculto', label: 'Etapa inteira aparece no formulário (desative pra pular)' },
    { name: 'apoio_tipo', label: 'Tipo de apoio financeiro' },
    { name: 'ajuda_igreja', label: 'Igreja ajudará financeiramente?' },
    { name: 'pagar_tudo', label: 'Consegue pagar tudo?' },
    { name: 'mantenedores', label: 'Levantará mantenedores?' },
    { name: 'situacao_financeira', label: 'Situação financeira' },
    { name: 'dividas', label: 'Possui dívidas?' },
  ]},
]

// Resolve o config efetivo de uma turma: config próprio da turma (se
// existir, mesmo que hidden_fields seja []) vence sobre o default da
// escola — sem merge campo a campo. payment_info é sempre da escola.
export function resolveFormConfig(
  schoolConfig: FormConfig | null | undefined,
  classConfig: FormConfig | null | undefined,
): { hiddenFields: string[]; paymentInfo: string | null } {
  return {
    hiddenFields: classConfig?.hidden_fields ?? schoolConfig?.hidden_fields ?? [],
    paymentInfo: schoolConfig?.payment_info ?? null,
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
