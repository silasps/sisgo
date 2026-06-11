// Mapeamento específico para o "DTS - Student's Application Form"
// (Google Forms em inglês) -> form_data do sisgo.
//
// Se um novo formulário do Google (outras escolas/EMBARK/etc.) tiver
// cabeçalhos diferentes, crie um novo arquivo nesta pasta seguindo o
// mesmo formato (export `signature`, `name` e `mapRow`) e registre-o
// em `run.mjs` na lista MAPPINGS.

import {
  clean,
  isEmpty,
  toTitleCase,
  mapYesNo,
  mapGender,
  parseDateBR,
  mapMaritalStatus,
  mapSelfAssessment,
  inferCountryFromNationality,
  parsePhone,
  mapComoConheceu,
  mapApoioTipo,
  mapMantenedores,
  parseEmergencyContact,
  parseChildren,
} from '../lib/transforms.mjs'

export const name = 'DTS Application Form (Google Forms, EN)'

// Cabeçalhos "âncora" usados para detectar automaticamente que um
// arquivo corresponde a este formulário.
export const signature = [
  'How did your hear about DTS?',
  'Please write about your conversion experience',
  'Are you above the age of consent in your country?',
]

const COL = {
  timestamp: 'Carimbo de data/hora',
  firstName: 'First Name',
  lastName2: 'Last Name 2',
  gender: 'Gender',
  dob: 'Date of Birth',
  nationalId: 'National ID Number',
  occupation: 'Occupation',
  address: 'Address',
  city: 'City',
  state: 'State',
  zip: 'Zip Code',
  email: 'E-mail',
  mobile: 'Mobile',
  citizenship: 'Citizenship',
  maritalStatus: 'Marital Status',
  why: 'Why do you want to attend the  DTS?',
  emergency: 'Name, telephone and e-mail address of the person we should contact in case of emergency',
  spouseName: 'Spouse Name',
  spouseAge: 'Spouse Age',
  marriedHowLong: 'For how long have you been married?',
  hasChildren: 'Do you have children?',
  childrenInfo: 'Name and age of children',
  churchName: 'Name of the Church ',
  churchTime: 'For how long are you a member of this church?',
  isLeader: 'Are you a leader at the church?',
  leaderWhat: 'What do you lead?',
  talkedPastor: 'Have you talked to your pastor/leader about your desire to attend the Communicatrs DTS?',
  pastorAgreed: 'Has your pastor/leader agreed?',
  pastorName: "Pastor's Name",
  pastorEmail: "Pastor's E-mail",
  pastorPhone: "Pastor's Telephone Number",
  howHeard: 'How did your hear about DTS?',
  selfLeadership: 'How do you evaluate yourself in these items? [Leadership]',
  selfObedience: 'How do you evaluate yourself in these items? [Obedience]',
  selfDevotional: 'How do you evaluate yourself in these items? [Intensity when seeking the Lord]',
  selfLearning: 'How do you evaluate yourself in these items? [Open to Learn]',
  selfMaturity: 'How do you evaluate yourself in these items? [Maturity]',
  selfTeamwork: 'How do you evaluate yourself in these items? [Teamwork]',
  selfTestify: 'How do you evaluate yourself in these items? [Ability to Testify]',
  selfPressure: 'How do you evaluate yourself in these items? [When Under Pressure]',
  christianHowLong: 'How long have you been a Christian?',
  conversion: 'Please write about your conversion experience',
  familyChristian: 'Is your family Christian?',
  takesMedicine: 'Do you take any medicine? ',
  criminalRecords: 'Do you have any criminal records?',
  pendingLegal: 'Do you have any pending matters with the law or are you involved in a lawsuit?',
  rehab: 'Have you ever been to a rehabilitation center?',
  financialSupport: 'What kind of financial support do you have?',
  churchSupport: 'Is your church going to support you finacially?',
  sponsor: 'Do you have any sponsor (family, friends, etc) who will help you?',
  canPayFees: 'Can you pay the application and school fees?',
  ageOfConsent: 'Are you above the age of consent in your country?',
}

function setIfDefined(obj, key, value) {
  if (value !== undefined && value !== null && value !== '') obj[key] = value
}

/**
 * @param {Record<string,string>} row - linha da planilha (chave = cabeçalho da coluna)
 * @param {{ escola: string, turma: string }} ctx
 * @returns {{ fullName: string, email: string, phone: string|undefined, formData: object, warnings: string[] }}
 */
export function mapRow(row, ctx) {
  const warnings = []
  const get = (key) => clean(row[COL[key]])

  const fullName = toTitleCase(`${get('firstName')} ${get('lastName2')}`.replace(/\s+/g, ' ').trim())
  const email = get('email')

  const { country: paisNacionalidade, iso2: iso2Nacionalidade } = inferCountryFromNationality(get('citizenship'), warnings)
  const mobile = parsePhone(get('mobile'), iso2Nacionalidade)

  const isBrasileiro = /brasil|brazil/i.test(get('citizenship')) ? 'sim' : 'nao'

  // ── s5: Dados pessoais ────────────────────────────────────────────
  const s5 = {}
  setIfDefined(s5, 'nome', fullName)
  setIfDefined(s5, 'sexo', mapGender(get('gender'), warnings))
  setIfDefined(s5, 'data_nascimento', parseDateBR(get('dob'), warnings))
  setIfDefined(s5, 'estado_civil', mapMaritalStatus(get('maritalStatus'), warnings))
  setIfDefined(s5, 'is_brasileiro', isBrasileiro)
  setIfDefined(s5, 'nacionalidade', get('citizenship'))
  setIfDefined(s5, 'profissao', get('occupation'))
  setIfDefined(s5, 'passaporte', get('nationalId'))
  setIfDefined(s5, 'cep', get('zip'))
  setIfDefined(s5, 'endereco', get('address'))
  setIfDefined(s5, 'cidade', get('city'))
  setIfDefined(s5, 'estado', get('state'))
  setIfDefined(s5, 'pais', paisNacionalidade)
  setIfDefined(s5, 'celular', mobile.number)
  setIfDefined(s5, 'celular_country', mobile.iso2)

  if (paisNacionalidade && get('address') && !get('address').toLowerCase().includes(paisNacionalidade.toLowerCase())) {
    // Apenas um lembrete — endereço pode estar em país diferente da nacionalidade
    // (ex.: refugiados, expatriados). Não é necessariamente um erro.
    warnings.push(`Confira "pais" (assumido "${paisNacionalidade}" pela nacionalidade) — o endereço informado é "${get('address')}, ${get('city')}, ${get('state')}".`)
  }

  const emergency = parseEmergencyContact(get('emergency'))
  if (emergency.nome) setIfDefined(s5, 'emergencia_nome', emergency.nome)
  if (emergency.telefone) {
    const emPhone = parsePhone(emergency.telefone, iso2Nacionalidade)
    setIfDefined(s5, 'emergencia_telefone', emPhone.number)
    setIfDefined(s5, 'emergencia_telefone_country', emPhone.iso2)
  }
  if (emergency.email) setIfDefined(s5, 'emergencia_email', emergency.email)

  // ── s4: Motivação ─────────────────────────────────────────────────
  const s4 = {}
  setIfDefined(s4, 'como_conheceu', mapComoConheceu(get('howHeard'), warnings))
  setIfDefined(s4, 'motivacao', get('why'))
  setIfDefined(s4, 'escola', ctx.escola)
  setIfDefined(s4, 'turma', ctx.turma)

  // ── s7: Família ───────────────────────────────────────────────────
  const s7 = {}
  const familyChristian = mapYesNo(get('familyChristian'), warnings, 'family Christian?')
  if (familyChristian === 'sim') setIfDefined(s7, 'pais_cristaos', 'ambos')
  else if (familyChristian === 'nao') setIfDefined(s7, 'pais_cristaos', 'nenhum')

  setIfDefined(s7, 'estado_civil_atual', s5.estado_civil)

  if (!isEmpty(get('spouseName'))) {
    const idade = get('spouseAge')
    setIfDefined(s7, 'conjuge_nome_idade', idade ? `${toTitleCase(get('spouseName'))}, ${idade} anos` : toTitleCase(get('spouseName')))
  }
  if (!isEmpty(get('marriedHowLong'))) setIfDefined(s7, 'tempo_casados', get('marriedHowLong'))

  const hasChildren = mapYesNo(get('hasChildren'), warnings, 'Do you have children?')
  if (hasChildren) {
    setIfDefined(s7, 'tem_filhos', hasChildren)
    if (hasChildren === 'sim') setIfDefined(s7, 'filhos_dados', parseChildren(get('childrenInfo')))
  }

  // ── s8: Igreja / liderança ────────────────────────────────────────
  const s8 = {}
  setIfDefined(s8, 'igreja_nome', get('churchName'))
  setIfDefined(s8, 'tempo_igreja', get('churchTime'))
  const isLeader = mapYesNo(get('isLeader'), warnings, 'Are you a leader at the church?')
  if (isLeader) {
    setIfDefined(s8, 'tem_lideranca', isLeader)
    if (isLeader === 'sim') setIfDefined(s8, 'lideranca_cargo', get('leaderWhat'))
  }
  setIfDefined(s8, 'conversou_pastor', mapYesNo(get('talkedPastor'), warnings, 'Have you talked to your pastor?'))
  setIfDefined(s8, 'pastor_concorda', mapYesNo(get('pastorAgreed'), warnings, "Has your pastor/leader agreed?"))
  setIfDefined(s8, 'pastor_nome', get('pastorName'))
  setIfDefined(s8, 'pastor_email', get('pastorEmail'))
  const pastorPhone = parsePhone(get('pastorPhone'), iso2Nacionalidade)
  setIfDefined(s8, 'pastor_telefone', pastorPhone.number)
  setIfDefined(s8, 'pastor_telefone_country', pastorPhone.iso2)

  // ── s11: Autoavaliação / conversão ───────────────────────────────
  const s11 = {}
  setIfDefined(s11, 'autoaval_liderança', mapSelfAssessment(get('selfLeadership'), warnings, 'Leadership'))
  setIfDefined(s11, 'autoaval_obediência', mapSelfAssessment(get('selfObedience'), warnings, 'Obedience'))
  setIfDefined(s11, 'autoaval_vida_devocional', mapSelfAssessment(get('selfDevotional'), warnings, 'Intensity when seeking the Lord'))
  setIfDefined(s11, 'autoaval_facilidade_de_aprender', mapSelfAssessment(get('selfLearning'), warnings, 'Open to Learn'))
  setIfDefined(s11, 'autoaval_maturidade_pessoal', mapSelfAssessment(get('selfMaturity'), warnings, 'Maturity'))
  setIfDefined(s11, 'autoaval_trabalho_em_equipe', mapSelfAssessment(get('selfTeamwork'), warnings, 'Teamwork'))
  setIfDefined(s11, 'autoaval_habilidade_para_falar_em_público', mapSelfAssessment(get('selfTestify'), warnings, 'Ability to Testify'))
  setIfDefined(s11, 'autoaval_capacidade_de_lidar_com_pressão', mapSelfAssessment(get('selfPressure'), warnings, 'When Under Pressure'))
  setIfDefined(s11, 'tempo_convertido', get('christianHowLong'))
  setIfDefined(s11, 'conversao', get('conversion'))
  setIfDefined(s11, 'recuperacao', mapYesNo(get('rehab'), warnings, 'Have you ever been to a rehabilitation center?'))

  // ── s12 / s13: Saúde e antecedentes ──────────────────────────────
  const s12 = {}
  setIfDefined(s12, 'usa_medicamento', mapYesNo(get('takesMedicine'), warnings, 'Do you take any medicine?'))

  const s13 = {}
  setIfDefined(s13, 'antecedente', mapYesNo(get('criminalRecords'), warnings, 'Do you have any criminal records?'))
  setIfDefined(s13, 'pendencia_juridica', mapYesNo(get('pendingLegal'), warnings, 'Do you have any pending matters with the law?'))

  // ── s14: Suporte financeiro ───────────────────────────────────────
  const s14 = {}
  setIfDefined(s14, 'apoio_tipo', mapApoioTipo(get('financialSupport'), warnings))
  setIfDefined(s14, 'ajuda_igreja', mapYesNo(get('churchSupport'), warnings, 'Is your church going to support you financially?'))
  setIfDefined(s14, 'pagar_tudo', mapYesNo(get('canPayFees'), warnings, 'Can you pay the application and school fees?'))
  setIfDefined(s14, 'mantenedores', mapMantenedores(get('sponsor'), warnings))

  // ── s16: Confirmação ──────────────────────────────────────────────
  const s16 = {}
  setIfDefined(s16, 'maior_18', mapYesNo(get('ageOfConsent'), warnings, 'Are you above the age of consent in your country?'))

  const formData = {}
  setIfDefined(formData, 's1', { email })
  if (Object.keys(s4).length) formData.s4 = s4
  if (Object.keys(s5).length) formData.s5 = s5
  if (Object.keys(s7).length) formData.s7 = s7
  if (Object.keys(s8).length) formData.s8 = s8
  if (Object.keys(s11).length) formData.s11 = s11
  if (Object.keys(s12).length) formData.s12 = s12
  if (Object.keys(s13).length) formData.s13 = s13
  if (Object.keys(s14).length) formData.s14 = s14
  if (Object.keys(s16).length) formData.s16 = s16

  return {
    fullName,
    email,
    phone: get('mobile') || undefined,
    formData,
    warnings,
  }
}
