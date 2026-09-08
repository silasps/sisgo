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
    other: string
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
    body: string              // {org} placeholder
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
    estado_civil: string
    is_brasileiro: string
    is_brasileiro_sim: string
    is_brasileiro_nao: string
    nacionalidade: string
    fluencia_portugues: string
    idioma_preferencia: string
    // Education & skills
    formacao_section: string
    escolaridade: string
    fundamental: string
    medio: string
    tecnico: string
    superior_incompleto: string
    superior: string
    pos_graduacao: string
    mestrado: string
    doutorado: string
    profissao: string
    habilidades: string
    habilidades_ph: string
    especializacao_profissional: string
    especializacao_profissional_ph: string
    escolas_jocum: string
    escolas_jocum_generic: string   // {orgName} placeholder, used when org_type !== 'jocum'
    escolas_jocum_ph: string
    escolas_jocum_mes_ano: string
    escolas_jocum_add: string
    escolas_jocum_remove: string
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
    passaporte_opcional: string
    passaporte_obrigatorio: string
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
    tempo_casados: string
    conjuge_vira: string
    certidao_casamento: string
    // Children
    tem_filhos: string
    filhos_dados: string
    filhos_dados_ph: string
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
    conversou_pastor: string
    pastor_concorda: string
    igreja_ciente: string
    pastor_hint: string
  }

  // ── S5: Experiência Recente ────────────────────────────────────────────
  s5: {
    section: string
    title: string
    tipo_label: string
    tipo_escola: string
    tipo_missao: string
    tipo_nenhuma: string
    escola_nome: string
    escola_periodo: string
    escola_lideranca_section: string
    escola_lider_nome: string
    escola_lider_email: string
    escola_lider_tel: string
    missao_descricao: string
    missao_organizacao: string
    missao_duracao: string
    missao_lideranca_section: string
    missao_lider_nome: string
    missao_lider_email: string
    missao_lider_tel: string
    conexao_section: string
    conhece_parente: string
    vinculo_tipo: string
    parentesco: string
    conhecido: string
    vinculo_nome: string
    vinculo_descricao: string
  }

  // ── S6: Servir nesta instituição ────────────────────────────────────────
  s6: {
    section: string
    title: string
    como_servir: string
    integral: string
    parcial: string
    temporario: string
    quanto_tempo: string
    quanto_tempo_ph: string
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
    decl_verdadeiro: string
    decl_respeito: string
    decl_sem_condenacao_menor: string
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
    tem_dividas: string
  }

  // ── S10: Documentos e Aceite Final ─────────────────────────────────────
  s10: {
    section: string
    title: string
    docs_intro: string
    foto_instrucoes_label: string
    foto_instrucoes: string
    doc_foto: string
    doc_rg_frente: string
    doc_rg_verso: string
    doc_passaporte: string
    lgpd_heading: string
    lgpd_text: string
    lgpd_checkbox: string
    maior_18: string
    decl_ciencia_verificacao: string
  }

  // ── Chrome da landing de "servir" (servir/page.tsx e variantes) ────────
  servirChrome: {
    hero_badge: string
    hero_title: string
    hero_subtitle: string
    cta_serve_here: string
    about_eyebrow: string
    opportunities_title: string
    learn_more: string
    no_ministry_hint: string
    registration_eyebrow: string
    registration_title: string
    registration_subtitle: string
    footer_tagline: string
    footer_other_opportunities: string
    footer_rights: string
  }

  // ── Chrome das páginas curtas de pré-inscrição (standalone/embed) ──────
  standaloneChrome: {
    badge: string
    learn_more: string
    powered_by: string
  }

  // ── Chrome do formulário grande pós-aceite (formulario-obreiro/[token]) ─
  bigFormChrome: {
    title: string
    link_expired_title: string
    link_expired_body: string
    already_sent_title: string
    already_sent_body: string
    welcome_title: string
    welcome_body_print: string
    welcome_body_online: string
    footer_contact: string
  }
}
