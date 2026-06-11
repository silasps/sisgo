// Funções utilitárias de transformação de dados vindas de formulários
// externos (Google Forms etc.) para o formato esperado pelo sisgo.
//
// Cada função aqui é "best effort": quando não consegue mapear com
// segurança, retorna `null`/`undefined` (campo fica em branco no
// form_data, para o usuário preencher depois) e/ou empurra um aviso
// para o array `warnings` passado por referência.

export function clean(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

export function isEmpty(value) {
  const v = clean(value).toLowerCase()
  return v === '' || v === 'n/a' || v === 'na' || v === 'none' || v === 'not available'
}

export function toTitleCase(value) {
  const v = clean(value)
  if (!v) return v
  return v
    .toLowerCase()
    .split(/(\s+|-)/)
    .map(part => (/^[\s-]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('')
}

// "Yes"/"No" (e variações em pt) -> "sim"/"nao"
export function mapYesNo(value, warnings, fieldLabel) {
  const v = clean(value).toLowerCase()
  if (!v) return undefined
  if (['yes', 'sim', 'y', 's'].includes(v)) return 'sim'
  if (['no', 'não', 'nao', 'n'].includes(v)) return 'nao'
  warnings?.push(`Não consegui interpretar "${value}" como sim/não para "${fieldLabel}". Deixei em branco.`)
  return undefined
}

// Male/Female -> M/F
export function mapGender(value, warnings) {
  const v = clean(value).toLowerCase()
  if (v.startsWith('m')) return 'M'
  if (v.startsWith('f')) return 'F'
  warnings?.push(`Gênero "${value}" não reconhecido. Deixei em branco.`)
  return undefined
}

// DD/MM/YYYY -> YYYY-MM-DD
export function parseDateBR(value, warnings, fieldLabel = 'data de nascimento') {
  const v = clean(value)
  if (!v) return undefined
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // já no formato ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  warnings?.push(`Não consegui converter "${value}" (${fieldLabel}) para data. Deixei em branco.`)
  return undefined
}

// Estado civil (inglês) -> enum do sistema
const MARITAL_MAP = {
  single: 'solteiro',
  married: 'casado',
  divorced: 'divorciado',
  widowed: 'viuvo',
  widower: 'viuvo',
  widow: 'viuvo',
  'de facto': 'uniao_estavel',
  'common law': 'uniao_estavel',
  separated: 'divorciado',
  // pt-br já no formato certo
  solteiro: 'solteiro',
  solteira: 'solteiro',
  casado: 'casado',
  casada: 'casado',
  divorciado: 'divorciado',
  divorciada: 'divorciado',
  viuvo: 'viuvo',
  viuva: 'viuvo',
}
export function mapMaritalStatus(value, warnings) {
  const v = clean(value).toLowerCase()
  if (!v) return undefined
  if (MARITAL_MAP[v]) return MARITAL_MAP[v]
  warnings?.push(`Estado civil "${value}" não reconhecido. Deixei em branco.`)
  return undefined
}

// Escala de autoavaliação (Excellent/Great/Good/Average) -> otimo/bom/regular/melhorar
const SELF_ASSESSMENT_MAP = {
  excellent: 'otimo',
  great: 'bom',
  good: 'regular',
  average: 'melhorar',
  poor: 'melhorar',
  // valores já em pt-br
  otimo: 'otimo',
  ótimo: 'otimo',
  bom: 'bom',
  regular: 'regular',
  melhorar: 'melhorar',
}
export function mapSelfAssessment(value, warnings, fieldLabel) {
  const v = clean(value).toLowerCase()
  if (!v) return undefined
  if (SELF_ASSESSMENT_MAP[v]) return SELF_ASSESSMENT_MAP[v]
  warnings?.push(`Autoavaliação "${value}" (${fieldLabel}) não reconhecida. Deixei em branco.`)
  return undefined
}

// Nacionalidade/cidadania -> { country, iso2 }. Lista não exaustiva —
// adicione novas entradas conforme aparecerem novos países.
export const NATIONALITY_TO_COUNTRY = {
  kenyan: { country: 'Kenya', iso2: 'KE' },
  kenya: { country: 'Kenya', iso2: 'KE' },
  norwegian: { country: 'Norway', iso2: 'NO' },
  norway: { country: 'Norway', iso2: 'NO' },
  brazilian: { country: 'Brazil', iso2: 'BR' },
  brasileiro: { country: 'Brazil', iso2: 'BR' },
  brasileira: { country: 'Brazil', iso2: 'BR' },
  brasil: { country: 'Brazil', iso2: 'BR' },
  afghan: { country: 'Afghanistan', iso2: 'AF' },
  afghanistan: { country: 'Afghanistan', iso2: 'AF' },
  pakistani: { country: 'Pakistan', iso2: 'PK' },
  pakistan: { country: 'Pakistan', iso2: 'PK' },
  american: { country: 'United States', iso2: 'US' },
  usa: { country: 'United States', iso2: 'US' },
  british: { country: 'United Kingdom', iso2: 'GB' },
  ugandan: { country: 'Uganda', iso2: 'UG' },
  tanzanian: { country: 'Tanzania', iso2: 'TZ' },
  ethiopian: { country: 'Ethiopia', iso2: 'ET' },
  german: { country: 'Germany', iso2: 'DE' },
  swedish: { country: 'Sweden', iso2: 'SE' },
  danish: { country: 'Denmark', iso2: 'DK' },
  portuguese: { country: 'Portugal', iso2: 'PT' },
}

// Código de discagem (DDI) -> ISO2, para inferir o país do telefone
// quando o número vem com prefixo "+NN".
const DIAL_CODE_TO_ISO2 = {
  '1': 'US',
  '7': 'RU',
  '47': 'NO',
  '44': 'GB',
  '49': 'DE',
  '46': 'SE',
  '45': 'DK',
  '55': 'BR',
  '92': 'PK',
  '93': 'AF',
  '254': 'KE',
  '255': 'TZ',
  '256': 'UG',
  '251': 'ET',
  '351': 'PT',
}

// Recebe a "Citizenship" do formulário e devolve { country, iso2 } —
// usado como base para s5.pais e s5.celular_country / s7 etc.
export function inferCountryFromNationality(nationality, warnings) {
  const v = clean(nationality).toLowerCase()
  if (!v) return { country: undefined, iso2: undefined }
  if (NATIONALITY_TO_COUNTRY[v]) return NATIONALITY_TO_COUNTRY[v]
  warnings?.push(`Nacionalidade "${nationality}" não está no dicionário de países. Confira "pais" e o código de telefone manualmente.`)
  return { country: clean(nationality), iso2: undefined }
}

// Limpa o número de telefone removendo um eventual prefixo "+NN " e
// tenta inferir o ISO2 a partir desse prefixo. Se não houver prefixo,
// usa o `fallbackIso2` (normalmente derivado da nacionalidade).
export function parsePhone(value, fallbackIso2) {
  const v = clean(value)
  if (!v) return { number: undefined, iso2: fallbackIso2 }
  const m = v.match(/^\+(\d{1,3})\s*(.*)$/)
  if (m) {
    const [, dial, rest] = m
    const iso2 = DIAL_CODE_TO_ISO2[dial] ?? fallbackIso2
    return { number: rest.replace(/\s+/g, ''), iso2 }
  }
  return { number: v, iso2: fallbackIso2 }
}

// "Como você ouviu falar do DTS?" -> enum aproximado
export function mapComoConheceu(value, warnings) {
  const v = clean(value).toLowerCase()
  if (!v) return undefined
  if (v.includes('website') || v.includes('site')) return 'site'
  if (v.includes('instagram') || v.includes('facebook') || v.includes('social')) return 'redes_sociais'
  if (v.includes('relative') || v.includes('friend') || v.includes('attended') || v.includes('pastor') || v.includes('church') || v.includes('indica')) return 'indicacao'
  warnings?.push(`"Como conheceu" = "${value}" não reconhecido com certeza — mapeei para "outro". Confira.`)
  return 'outro'
}

// Tipo de suporte financeiro -> enum aproximado (heurística por palavras-chave)
export function mapApoioTipo(value, warnings) {
  const v = clean(value).toLowerCase()
  if (!v) return undefined
  const mentionsSelf = /(my own|myself|personal saving|sufficient fund|i work|i cover|própri)/.test(v)
  const mentionsFamily = /(parent|family|famíli)/.test(v)
  const mentionsChurch = /(church|igreja)/.test(v)
  if (mentionsSelf && mentionsFamily) return 'misto'
  if (mentionsSelf && !mentionsFamily && !mentionsChurch) return 'proprio'
  if (mentionsChurch) {
    warnings?.push(`"Tipo de suporte financeiro" menciona igreja ("${value}") — confira o valor de "apoio_tipo" manualmente.`)
    return undefined
  }
  if (mentionsFamily) return 'misto'
  warnings?.push(`Não consegui classificar o tipo de suporte financeiro: "${value}". Deixei em branco.`)
  return undefined
}

// "Tem patrocinador?" Yes/No -> enum aproximado. Como o formulário do
// Google só pergunta sim/não (e o sistema tem um enum mais detalhado
// sobre o processo de captação), "Yes" é mapeado para
// "sim_nao_iniciou" com aviso para o usuário confirmar.
export function mapMantenedores(value, warnings) {
  const v = clean(value).toLowerCase()
  if (!v) return undefined
  if (['no', 'não', 'nao'].includes(v)) return 'nao'
  if (['yes', 'sim'].includes(v)) {
    warnings?.push('Campo "mantenedores": formulário só diz "Yes/No", mapeei para "sim_nao_iniciou" (sim, processo de captação ainda não iniciado). Confira/ajuste se necessário.')
    return 'sim_nao_iniciou'
  }
  warnings?.push(`"Tem patrocinador?" = "${value}" não reconhecido. Deixei em branco.`)
  return undefined
}

// Extrai nome / telefone / e-mail de um campo livre de "contato de
// emergência", que pode vir em vários formatos:
//  - "salome ,0719862068,mutumasalome@gmail.com"
//  - "Lise Erøy, +47 90085524, lise@eroy.no"
//  - "Name: Not available\nTelephone: N/A\nE-mail: N/A"
export function parseEmergencyContact(value) {
  const raw = clean(value)
  if (!raw || isEmpty(raw)) return { nome: undefined, telefone: undefined, email: undefined }

  const emailMatch = raw.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  const email = emailMatch ? emailMatch[0] : undefined

  let rest = email ? raw.replace(email, '') : raw
  const phoneMatch = rest.match(/\+?\d[\d\s\-()]{5,}\d/)
  const telefone = phoneMatch ? phoneMatch[0].replace(/\s+/g, '') : undefined
  if (phoneMatch) rest = rest.replace(phoneMatch[0], '')

  let nome = rest
    .replace(/name\s*:/gi, '')
    .replace(/telephone\s*:/gi, '')
    .replace(/e-?mail( address)?\s*:/gi, '')
    .replace(/[\n,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (isEmpty(nome)) nome = undefined
  if (telefone && isEmpty(telefone)) return { nome, telefone: undefined, email }
  if (email && isEmpty(email)) return { nome, telefone, email: undefined }

  return {
    nome: nome ? toTitleCase(nome) : undefined,
    telefone,
    email,
  }
}

// "hope nina 17 years,gloria kanana 13 years ,maria mona 11 years"
// -> "Hope Nina (17 anos), Gloria Kanana (13 anos), Maria Mona (11 anos)"
export function parseChildren(value) {
  const raw = clean(value)
  if (!raw || isEmpty(raw)) return undefined
  const parts = raw.split(',').map(p => p.trim()).filter(Boolean)
  const formatted = parts.map(part => {
    const m = part.match(/^(.*?)\s+(\d+)\s*(years?|anos?)$/i)
    if (m) return `${toTitleCase(m[1])} (${m[2]} anos)`
    return toTitleCase(part)
  })
  return formatted.join(', ')
}
