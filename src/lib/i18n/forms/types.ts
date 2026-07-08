export type Lang = 'pt' | 'en' | 'es'

export interface FormDict {
  lang: Lang

  // ── Navigation / chrome ────────────────────────────────────────────────
  nav: {
    section_of: string        // "Seção {n} de {total}" — {n} and {total} replaced in component
    back: string              // "← Anterior"
    next: string              // "Próximo →"
    submit: string            // "Enviar formulário ✓"
    saving: string            // "Salvando…"
    error_save: string
    select_placeholder: string // "Selecione…"
    loading_cep: string
    searching_cep: string
  }

  // ── Lang switcher ──────────────────────────────────────────────────────
  langSwitcher: { label: string }

  // ── Common options ─────────────────────────────────────────────────────
  opts: {
    yes: string
    no: string
    partially: string
    not_applicable: string
    gender_m: string
    gender_f: string
    native: string
    basic: string
    intermediate: string
    advanced: string
    fluent: string
    dont_speak: string
    currently_studying: string
    studied_before: string
  }

  // ── Submitted screen ───────────────────────────────────────────────────
  submitted: {
    title: string
    body: string      // use {school} as placeholder
    next_title: string
    next_body: string
    gen_pastor: string
    new_pastor: string
    gen_friend: string
    new_friend: string
    copy: string
    copied: string
    generating: string
    link_hint: string
  }

  // ── Section 1 ──────────────────────────────────────────────────────────
  s1: {
    section: string
    title: string
    email: string
  }

  // ── Section 3 ──────────────────────────────────────────────────────────
  s3: {
    section: string
    title: string
    terms: string[]   // exactly 10 items
    aceite: string
  }

  // ── Section 4 ──────────────────────────────────────────────────────────
  s4: {
    section: string
    title: string
    escola: string
    turma: string
    como_conheceu: string
    como_conheceu_jocum: string
    conversou_equipe: string
    conversou_com_quem: string
    motivacao: string
    how_know_indicacao: string
    how_know_redes: string
    how_know_site: string
    how_know_evento: string
    how_know_church: string
    how_know_outro: string
    conversou_sim: string
    conversou_nao: string
  }

  // ── Section 5 ──────────────────────────────────────────────────────────
  s5: {
    section: string
    title: string
    nome: string
    sexo: string
    data_nascimento: string
    estado_civil: string
    is_brasileiro: string
    is_brasileiro_sim: string
    is_brasileiro_nao: string
    nacionalidade: string
    fluencia_portugues: string
    // Marital options
    solteiro: string; casado: string; comprometido: string; divorciado: string; viuvo: string
    // Sub-sections
    formacao_section: string
    formacao: string
    estudando: string
    curso_atual: string
    profissao: string
    trabalha: string
    experiencias: string
    habilidades: string
    idiomas_section: string
    idioma_portugues: string
    idioma_ingles: string
    idioma_espanhol: string
    outro_idioma: string
    outro_idioma_placeholder: string
    documentos_section: string
    rg: string
    cpf: string
    passaporte_opcional: string
    passaporte_required: string
    servico_militar: string
    sm_sim: string; sm_nao: string; sm_na: string
    // Address
    endereco_section: string
    cep: string
    bairro: string
    endereco_rua: string
    cidade: string
    estado: string
    pais: string
    zip_placeholder: string
    celular: string
    // Social
    redes_section: string
    outros_links: string
    // Emergency
    emergencia_section: string
    emergencia_nome: string
    emergencia_parentesco: string
    emergencia_email: string
    emergencia_cidade: string
    // Civil status display
    civil_label: string    // "Estado civil:"
    civil_from_s5: string  // "(conforme informado na seção 5)"
  }

  // ── Section 6 ──────────────────────────────────────────────────────────
  s6: {
    section: string
    title: string
    sobre_voce: string
    processo_decisao: string
    expectativas: string
    motivacoes: string
    responsabilidades: string
  }

  // ── Section 7 ──────────────────────────────────────────────────────────
  s7: {
    section: string
    title: string
    nome_pai: string
    nome_mae: string
    pais_cristaos: string
    pc_ambos: string; pc_apenas_um: string; pc_nenhum: string
    familia_apoia: string
    situacao_familiar: string
    // Married
    conjuge_nome_idade: string
    tempo_casados: string
    conjuge_apoia: string
    conjuge_participa: string
    // Engaged
    tempo_compromisso: string
    compromisso_apoia: string
    situacao_relacional: string
    // Children
    tem_filhos: string
    filhos_dados: string
    filhos_virao: string
    filhos_ficam_com: string
  }

  // ── Section 8 ──────────────────────────────────────────────────────────
  s8: {
    section: string
    title: string
    igreja_nome: string
    igreja_cidade: string
    tempo_igreja: string
    membro_oficial: string
    tem_ministerio: string
    ministerio_qual: string
    ministerio_tempo: string
    tem_lideranca: string
    lideranca_cargo: string
    responsabilidades_igreja: string
    pastor_section: string
    conversou_pastor: string
    pastor_concorda: string
    pastor_nome: string
    pastor_cargo: string
    pastor_email: string
    pastor_telefone: string
    pastor_hint: string
    pastor_infobox: string
    pastor_pc_sim: string; pastor_pc_parcialmente: string; pastor_pc_nao: string
  }

  // ── Section 9 ──────────────────────────────────────────────────────────
  s9: {
    section: string
    title: string
    infobox: string
    ref_nome: string
    ref_relacionamento: string
    ref_tempo: string
    ref_crista: string
    ref_email: string
    ref_telefone: string
  }

  // ── Section 10 ─────────────────────────────────────────────────────────
  s10: {
    section: string
    title: string
    teve_historico: string
    hist_qual: string
    hist_org: string
    hist_duracao: string
    hist_quando: string
    hist_lider_nome: string
    hist_lider_email: string
    hist_lider_tel: string
    infobox: string
  }

  // ── Section 11 ─────────────────────────────────────────────────────────
  s11: {
    section: string
    title: string
    autoaval_title: string
    autoaval_areas: string[]   // 15 areas
    autoaval_cols: string[]    // 4 columns: Ótimo, Bom, Regular, Melhorar
    vida_section: string
    tempo_convertido: string
    conversao: string
    vida_deus: string
    devocional: string
    crescimento_espiritual: string
    chamado_section: string
    chamado: string
    chamado_opts: [string, string, string]  // sim, em_discernimento, nao
    chamado_descricao: string
    visao_missoes: string
    emocional_section: string
    psicologico: string
    psico_sim_faz: string; psico_sim_fez: string; psico_nao: string
    diagnostico_emocional: string
    acompanhamento_pastoral: string
    recuperacao_section: string
    recuperacao: string
    recuperacao_detalhes: string
    recuperacao_hoje: string
  }

  // ── Section 12 ─────────────────────────────────────────────────────────
  s12: {
    section: string
    title: string
    saude_geral: string
    alergias: string
    restricao_alimentar: string
    limitacao_fisica: string
    cirurgias: string
    usa_medicamento: string
    med_nome: string
    med_motivo: string
    med_dosagem: string
    med_receita: string
    plano_saude: string
    plano_saude_qual: string
    emergencia_medica: string
  }

  // ── Section 13 ─────────────────────────────────────────────────────────
  s13: {
    section: string
    title: string
    antecedente: string
    antecedente_descricao: string
    pendencia_juridica: string
    restricao_legal: string
    decls: string[]   // 3 items
  }

  // ── Section 14 ─────────────────────────────────────────────────────────
  s14: {
    section: string
    title: string
    infobox: string
    apoio_tipo: string
    at_proprio: string; at_familia: string; at_igreja: string; at_mantenedores: string; at_misto: string
    ajuda_igreja: string
    ai_sim: string; ai_nao: string; ai_em_conversa: string
    pagar_tudo: string
    pt_sim: string; pt_parcialmente: string; pt_nao: string
    mantenedores: string
    mt_sim_ja: string; mt_sim_nao: string; mt_nao: string
    situacao_financeira: string
    dividas: string
  }

  // ── Section 15 ─────────────────────────────────────────────────────────
  s15: {
    section: string
    title: string
    infobox: string
    doc_foto: string
    doc_rg_frente_br: string
    doc_rg_verso_br: string
    doc_cpf: string
    doc_passaporte_br: string
    doc_passaporte_estrangeiro: string
    doc_id_frente: string
    doc_id_verso: string
  }

  // ── Section 16 ─────────────────────────────────────────────────────────
  s16: {
    section: string
    title: string
    maior_18: string
    finals: string[]   // 5 items
  }

  // ── Reference form ─────────────────────────────────────────────────────
  ref: {
    // Page-level (server component strings)
    expired_title: string
    expired_body: string
    already_sent_title: string
    already_sent_body: string
    confidential: string
    footer: string
    // Form header
    form_type_pastor: string
    form_type_amigo: string
    ref_for: string    // "Referência para" — name added by component
    // Pastor form
    pastor_intro: string  // {name} placeholder
    pastor_nome: string
    pastor_cargo: string
    pastor_igreja: string
    pastor_cidade: string
    pastor_tempo_conhece: string
    pastor_email: string
    pastor_phone: string
    pastor_eval_title: string
    pastor_carater_q: string   // {name} placeholder
    pastor_responsabilidade: string
    pastor_dificuldades: string
    pastor_dificuldades_ph: string
    pastor_autoridade: string
    pastor_recomenda: string
    pastor_rec_sim: string; pastor_rec_ressalvas: string; pastor_rec_nao: string
    pastor_observacoes: string
    pastor_observacoes_ph: string
    pastor_apoia: string       // {name} placeholder
    pastor_apoia_sim: string; pastor_apoia_nao: string
    pastor_decl: string
    // Friend form
    amigo_intro: string        // {name} placeholder
    amigo_nome: string
    amigo_como_conheceu: string
    amigo_tempo: string
    amigo_crista: string
    amigo_email: string
    amigo_phone: string
    amigo_sobre_title: string
    amigo_carater_q: string    // {name} placeholder
    amigo_pontos_fortes: string
    amigo_crescimento: string
    amigo_pressao: string      // {name} placeholder
    amigo_relacionamentos: string
    amigo_recomenda: string
    amigo_observacoes: string
    amigo_observacoes_ph: string
    amigo_decl: string
    conduta_menores_q: string  // {name} placeholder
    conduta_menores_detalhe: string
    // Common
    submit: string
    submitting: string
    success_title: string
    success_body: string  // {school} placeholder
  }

  // ── Registration (pre-inscription) form ────────────────────────────────
  registration: {
    full_name: string
    full_name_ph: string
    email: string
    email_ph: string
    language: string
    language_ph: string
    communication_language: string
    communication_language_ph: string
    phone: string
    phone_optional: string
    class_interest: string
    class_no_pref: string
    message: string
    message_optional: string
    message_ph: string
    submit: string
    submitting: string
    success_title: string
    success_body: string
    contact_consent: string
    error_fallback: string
  }
}
