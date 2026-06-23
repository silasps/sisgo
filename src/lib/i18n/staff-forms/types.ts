export type StaffLang = 'pt' | 'en' | 'es'

export interface StaffFormDict {
  lang: StaffLang

  // ── Navigation / chrome ────────────────────────────────────────────────
  nav: {
    section_of: string        // "Seção {n} de {total}"
    back: string
    next: string
    submit: string
    saving: string
    error_save: string
    select_placeholder: string
    loading_cep: string
  }

  // ── Lang switcher ──────────────────────────────────────────────────────
  langSwitcher: { label: string }

  // ── Common options ─────────────────────────────────────────────────────
  opts: {
    yes: string
    no: string
    partially: string
    gender_m: string
    gender_f: string
    native: string
    basic: string
    intermediate: string
    advanced: string
    fluent: string
    dont_speak: string
  }

  // ── Submitted screen ───────────────────────────────────────────────────
  submitted: {
    title: string
    body: string              // {base} placeholder
  }

  // ── S1: E-mail ─────────────────────────────────────────────────────────
  s1: {
    section: string
    title: string
    email: string
    email_hint: string
  }

  // ── S2: Dados Pessoais ─────────────────────────────────────────────────
  s2: {
    section: string
    title: string
    nome: string
    sexo: string
    data_nascimento: string
    is_brasileiro: string
    is_brasileiro_sim: string
    is_brasileiro_nao: string
    nacionalidade: string
    fluencia_portugues: string
    formacao: string
    // Education levels
    fundamental: string
    medio: string
    tecnico: string
    superior_incompleto: string
    superior: string
    pos_graduacao: string
    mestrado: string
    doutorado: string
    // Skills & specialization
    habilidades: string
    habilidades_ph: string
    especializacao_profissional: string
    especializacao_profissional_ph: string
    escolas_jocum: string
    escolas_jocum_ph: string
    // Languages
    idiomas_section: string
    idioma_portugues: string
    idioma_ingles: string
    idioma_espanhol: string
    outro_idioma: string
    outro_idioma_ph: string
    // Documents
    documentos_section: string
    rg: string
    cpf: string
    passaporte: string
    // Address
    endereco_section: string
    cep: string
    endereco_rua: string
    bairro: string
    cidade: string
    estado: string
    pais: string
    zip_ph: string
    celular: string
    email_contato: string
    // Social media
    redes_section: string
    instagram: string
    facebook: string
    tiktok: string
    linkedin: string
    // Emergency contact
    emergencia_section: string
    emergencia_nome: string
    emergencia_parentesco: string
    emergencia_telefone: string
    emergencia_email: string
    emergencia_cidade: string
  }

  // ── S3: Família ────────────────────────────────────────────────────────
  s3: {
    section: string
    title: string
    civil_label: string
    civil_from_s2: string
    // Marital options
    solteiro: string
    casado: string
    divorciado: string
    viuvo: string
    // Spouse
    conjuge_section: string
    conjuge_nome: string
    conjuge_data_nascimento: string
    conjuge_telefone: string
    conjuge_email: string
    certidao_casamento: string
    certidao_upload: string
    // Children
    tem_filhos: string
    filhos_section: string
    filho_nome: string
    filho_ano_nascimento: string
    add_filho: string
    filhos_virao: string
  }

  // ── S4: Igreja e Vida Espiritual ───────────────────────────────────────
  s4: {
    section: string
    title: string
    igreja_nome: string
    igreja_cidade: string
    tempo_igreja: string
    membro: string
    tem_ministerio: string
    ministerio_qual: string
    tem_lideranca: string
    lideranca_qual: string
    pastor_section: string
    pastor_nome: string
    pastor_cargo: string
    pastor_email: string
    pastor_telefone: string
    igreja_ciente: string
    pastor_concorda: string
  }

  // ── S5: Experiência Missionária ────────────────────────────────────────
  s5: {
    section: string
    title: string
    serviu_projeto: string
    projeto_qual: string
    projeto_descreva: string
    org_base_nome: string
    lideranca_contato: string
    lideranca_contato_ph: string
    conhece_parente: string
    conhece_quem: string
    conhece_descreva: string
    parentesco: string
    conhecido: string
  }

  // ── S6: Servir na Base ─────────────────────────────────────────────────
  s6: {
    section: string
    title: string
    como_servir: string
    integral: string
    parcial: string
    temporario: string
    quanto_tempo: string
    qual_ministerio: string
    data_chegada: string
    motivacao: string
    motivacao_ph: string
  }

  // ── S7: Saúde ──────────────────────────────────────────────────────────
  s7: {
    section: string
    title: string
    problema_saude: string
    problema_saude_desc: string
    limitacao_fisica: string
    limitacao_fisica_desc: string
    medicamento_controlado: string
    medicamento_controlado_desc: string
    alergia: string
    alergia_desc: string
  }

  // ── S8: Questões Jurídicas ─────────────────────────────────────────────
  s8: {
    section: string
    title: string
    pendencia_judicial: string
    pendencia_judicial_desc: string
    decls: string[]          // legal declaration checkboxes
  }

  // ── S9: Finanças ───────────────────────────────────────────────────────
  s9: {
    section: string
    title: string
    apoio_financeiro: string
    apoio_qual: string
    apoio_qual_ph: string
    situacao_financeira: string
    situacao_financeira_ph: string
  }

  // ── S10: Documentos e Aceite Final ─────────────────────────────────────
  s10: {
    section: string
    title: string
    foto_instrucoes: string
    doc_foto: string
    doc_rg_frente: string
    doc_rg_verso: string
    doc_cpf: string
    doc_passaporte: string
    lgpd_label: string
    lgpd_text: string
    finals: string[]          // final declaration checkboxes
  }
}
