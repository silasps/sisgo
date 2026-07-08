export type PhoneCountry = {
  code: string   // dial code, ex: "+55"
  flag: string   // emoji
  name: string   // country name in Portuguese
  iso: string    // ISO 3166-1 alpha-2
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  // ── América do Sul ──────────────────────────────────────────
  { code: '+55',  flag: '🇧🇷', name: 'Brasil',               iso: 'BR' },
  { code: '+54',  flag: '🇦🇷', name: 'Argentina',            iso: 'AR' },
  { code: '+591', flag: '🇧🇴', name: 'Bolívia',              iso: 'BO' },
  { code: '+56',  flag: '🇨🇱', name: 'Chile',                iso: 'CL' },
  { code: '+57',  flag: '🇨🇴', name: 'Colômbia',             iso: 'CO' },
  { code: '+593', flag: '🇪🇨', name: 'Equador',              iso: 'EC' },
  { code: '+592', flag: '🇬🇾', name: 'Guiana',               iso: 'GY' },
  { code: '+595', flag: '🇵🇾', name: 'Paraguai',             iso: 'PY' },
  { code: '+51',  flag: '🇵🇪', name: 'Peru',                 iso: 'PE' },
  { code: '+597', flag: '🇸🇷', name: 'Suriname',             iso: 'SR' },
  { code: '+598', flag: '🇺🇾', name: 'Uruguai',              iso: 'UY' },
  { code: '+58',  flag: '🇻🇪', name: 'Venezuela',            iso: 'VE' },
  // ── América Central e Caribe ────────────────────────────────
  { code: '+1',   flag: '🇺🇸', name: 'EUA / Canadá',         iso: 'US' },
  { code: '+52',  flag: '🇲🇽', name: 'México',               iso: 'MX' },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica',           iso: 'CR' },
  { code: '+53',  flag: '🇨🇺', name: 'Cuba',                 iso: 'CU' },
  { code: '+1787',flag: '🇵🇷', name: 'Porto Rico',           iso: 'PR' },
  { code: '+1809',flag: '🇩🇴', name: 'República Dominicana', iso: 'DO' },
  { code: '+503', flag: '🇸🇻', name: 'El Salvador',          iso: 'SV' },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala',            iso: 'GT' },
  { code: '+509', flag: '🇭🇹', name: 'Haiti',                iso: 'HT' },
  { code: '+504', flag: '🇭🇳', name: 'Honduras',             iso: 'HN' },
  { code: '+1876',flag: '🇯🇲', name: 'Jamaica',              iso: 'JM' },
  { code: '+505', flag: '🇳🇮', name: 'Nicarágua',            iso: 'NI' },
  { code: '+507', flag: '🇵🇦', name: 'Panamá',               iso: 'PA' },
  // ── Europa ──────────────────────────────────────────────────
  { code: '+351', flag: '🇵🇹', name: 'Portugal',             iso: 'PT' },
  { code: '+44',  flag: '🇬🇧', name: 'Reino Unido',          iso: 'GB' },
  { code: '+49',  flag: '🇩🇪', name: 'Alemanha',             iso: 'DE' },
  { code: '+43',  flag: '🇦🇹', name: 'Áustria',              iso: 'AT' },
  { code: '+32',  flag: '🇧🇪', name: 'Bélgica',              iso: 'BE' },
  { code: '+420', flag: '🇨🇿', name: 'República Tcheca',     iso: 'CZ' },
  { code: '+45',  flag: '🇩🇰', name: 'Dinamarca',            iso: 'DK' },
  { code: '+34',  flag: '🇪🇸', name: 'Espanha',              iso: 'ES' },
  { code: '+358', flag: '🇫🇮', name: 'Finlândia',            iso: 'FI' },
  { code: '+33',  flag: '🇫🇷', name: 'França',               iso: 'FR' },
  { code: '+30',  flag: '🇬🇷', name: 'Grécia',               iso: 'GR' },
  { code: '+36',  flag: '🇭🇺', name: 'Hungria',              iso: 'HU' },
  { code: '+353', flag: '🇮🇪', name: 'Irlanda',              iso: 'IE' },
  { code: '+39',  flag: '🇮🇹', name: 'Itália',               iso: 'IT' },
  { code: '+31',  flag: '🇳🇱', name: 'Países Baixos',        iso: 'NL' },
  { code: '+47',  flag: '🇳🇴', name: 'Noruega',              iso: 'NO' },
  { code: '+48',  flag: '🇵🇱', name: 'Polônia',              iso: 'PL' },
  { code: '+40',  flag: '🇷🇴', name: 'Romênia',              iso: 'RO' },
  { code: '+7',   flag: '🇷🇺', name: 'Rússia',               iso: 'RU' },
  { code: '+46',  flag: '🇸🇪', name: 'Suécia',               iso: 'SE' },
  { code: '+41',  flag: '🇨🇭', name: 'Suíça',                iso: 'CH' },
  { code: '+380', flag: '🇺🇦', name: 'Ucrânia',              iso: 'UA' },
  // ── África ──────────────────────────────────────────────────
  { code: '+244', flag: '🇦🇴', name: 'Angola',               iso: 'AO' },
  { code: '+238', flag: '🇨🇻', name: 'Cabo Verde',           iso: 'CV' },
  { code: '+20',  flag: '🇪🇬', name: 'Egito',                iso: 'EG' },
  { code: '+251', flag: '🇪🇹', name: 'Etiópia',              iso: 'ET' },
  { code: '+233', flag: '🇬🇭', name: 'Gana',                 iso: 'GH' },
  { code: '+254', flag: '🇰🇪', name: 'Quênia',               iso: 'KE' },
  { code: '+212', flag: '🇲🇦', name: 'Marrocos',             iso: 'MA' },
  { code: '+258', flag: '🇲🇿', name: 'Moçambique',           iso: 'MZ' },
  { code: '+234', flag: '🇳🇬', name: 'Nigéria',              iso: 'NG' },
  { code: '+239', flag: '🇸🇹', name: 'São Tomé e Príncipe',  iso: 'ST' },
  { code: '+27',  flag: '🇿🇦', name: 'África do Sul',        iso: 'ZA' },
  { code: '+255', flag: '🇹🇿', name: 'Tanzânia',             iso: 'TZ' },
  { code: '+256', flag: '🇺🇬', name: 'Uganda',               iso: 'UG' },
  // ── Oriente Médio ───────────────────────────────────────────
  { code: '+966', flag: '🇸🇦', name: 'Arábia Saudita',       iso: 'SA' },
  { code: '+971', flag: '🇦🇪', name: 'Emirados Árabes',      iso: 'AE' },
  { code: '+972', flag: '🇮🇱', name: 'Israel',               iso: 'IL' },
  { code: '+90',  flag: '🇹🇷', name: 'Turquia',              iso: 'TR' },
  // ── Ásia e Pacífico ─────────────────────────────────────────
  { code: '+61',  flag: '🇦🇺', name: 'Austrália',            iso: 'AU' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh',           iso: 'BD' },
  { code: '+86',  flag: '🇨🇳', name: 'China',                iso: 'CN' },
  { code: '+63',  flag: '🇵🇭', name: 'Filipinas',            iso: 'PH' },
  { code: '+91',  flag: '🇮🇳', name: 'Índia',                iso: 'IN' },
  { code: '+62',  flag: '🇮🇩', name: 'Indonésia',            iso: 'ID' },
  { code: '+81',  flag: '🇯🇵', name: 'Japão',                iso: 'JP' },
  { code: '+60',  flag: '🇲🇾', name: 'Malásia',              iso: 'MY' },
  { code: '+64',  flag: '🇳🇿', name: 'Nova Zelândia',        iso: 'NZ' },
  { code: '+92',  flag: '🇵🇰', name: 'Paquistão',            iso: 'PK' },
  { code: '+65',  flag: '🇸🇬', name: 'Singapura',            iso: 'SG' },
  { code: '+94',  flag: '🇱🇰', name: 'Sri Lanka',            iso: 'LK' },
  { code: '+66',  flag: '🇹🇭', name: 'Tailândia',            iso: 'TH' },
  { code: '+886', flag: '🇹🇼', name: 'Taiwan',               iso: 'TW' },
  { code: '+84',  flag: '🇻🇳', name: 'Vietnã',               iso: 'VN' },
  { code: '+82',  flag: '🇰🇷', name: 'Coreia do Sul',        iso: 'KR' },
]

/** Aplica máscara de telefone de acordo com o código de discagem do país. */
export function formatPhoneByDialCode(dialCode: string, raw: string): string {
  const digits = raw.replace(/\D/g, '')

  if (dialCode === '+55') {
    const local = digits.slice(0, 11)
    if (local.length <= 2) return local ? `(${local}` : ''
    if (local.length <= 6) return `(${local.slice(0, 2)}) ${local.slice(2)}`
    if (local.length <= 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }

  if (dialCode === '+1') {
    const local = digits.slice(0, 10)
    if (local.length <= 3) return local ? `(${local}` : ''
    if (local.length <= 6) return `(${local.slice(0, 3)}) ${local.slice(3)}`
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
  }

  if (dialCode === '+351') {
    const local = digits.slice(0, 9)
    if (local.length <= 3) return local
    if (local.length <= 6) return `${local.slice(0, 3)} ${local.slice(3)}`
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }

  if (dialCode === '+54') {
    // Argentina: 2/3 dígitos de área + 6/7 dígitos de linha
    const local = digits.slice(0, 10)
    if (local.length <= 3) return local
    if (local.length <= 6) return `${local.slice(0, 3)} ${local.slice(3)}`
    return `${local.slice(0, 3)} ${local.slice(3, 6)}-${local.slice(6)}`
  }

  if (dialCode === '+34') {
    // Espanha: 3+3+3
    const local = digits.slice(0, 9)
    if (local.length <= 3) return local
    if (local.length <= 6) return `${local.slice(0, 3)} ${local.slice(3)}`
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }

  if (dialCode === '+44') {
    // Reino Unido: 4+6
    const local = digits.slice(0, 10)
    if (local.length <= 4) return local
    return `${local.slice(0, 4)} ${local.slice(4)}`
  }

  // Demais países: apenas dígitos, limitado a um tamanho razoável
  return digits.slice(0, 15)
}

export type Language = {
  code: string
  label: string   // displayed in the form
  nativeLabel: string  // name in the language itself
}

export const LANGUAGES: Language[] = [
  { code: 'pt-BR', label: 'Português (Brasil)',    nativeLabel: 'Português (Brasil)' },
  { code: 'pt-PT', label: 'Português (Portugal)',  nativeLabel: 'Português (Portugal)' },
  { code: 'en',    label: 'Inglês',                nativeLabel: 'English' },
  { code: 'es',    label: 'Espanhol',              nativeLabel: 'Español' },
  { code: 'fr',    label: 'Francês',               nativeLabel: 'Français' },
  { code: 'de',    label: 'Alemão',                nativeLabel: 'Deutsch' },
  { code: 'it',    label: 'Italiano',              nativeLabel: 'Italiano' },
  { code: 'nl',    label: 'Holandês',              nativeLabel: 'Nederlands' },
  { code: 'pl',    label: 'Polonês',               nativeLabel: 'Polski' },
  { code: 'ru',    label: 'Russo',                 nativeLabel: 'Русский' },
  { code: 'uk',    label: 'Ucraniano',             nativeLabel: 'Українська' },
  { code: 'ja',    label: 'Japonês',               nativeLabel: '日本語' },
  { code: 'zh-CN', label: 'Chinês (Simplificado)', nativeLabel: '中文（简体）' },
  { code: 'zh-TW', label: 'Chinês (Tradicional)',  nativeLabel: '中文（繁體）' },
  { code: 'ko',    label: 'Coreano',               nativeLabel: '한국어' },
  { code: 'hi',    label: 'Hindi',                 nativeLabel: 'हिन्दी' },
  { code: 'ar',    label: 'Árabe',                 nativeLabel: 'العربية' },
  { code: 'id',    label: 'Indonésio / Malaio',    nativeLabel: 'Bahasa Indonesia' },
  { code: 'tl',    label: 'Filipino / Tagalog',    nativeLabel: 'Filipino' },
  { code: 'th',    label: 'Tailandês',             nativeLabel: 'ภาษาไทย' },
  { code: 'vi',    label: 'Vietnamita',            nativeLabel: 'Tiếng Việt' },
  { code: 'sw',    label: 'Suaíli',                nativeLabel: 'Kiswahili' },
  { code: 'am',    label: 'Amárico',               nativeLabel: 'አማርኛ' },
  { code: 'af',    label: 'Africâner',             nativeLabel: 'Afrikaans' },
  { code: 'other', label: 'Outro idioma',          nativeLabel: 'Other' },
]

/**
 * Tenta adivinhar o código de LANGUAGES mais próximo a partir dos idiomas
 * do navegador (ex.: navigator.languages). Usado só como sugestão inicial
 * do campo "língua materna" — o visitante pode sempre trocar.
 */
export function guessLanguageCode(browserLangs: readonly string[]): string {
  for (const raw of browserLangs) {
    const lower = raw.toLowerCase()
    const exact = LANGUAGES.find(l => l.code.toLowerCase() === lower)
    if (exact) return exact.code

    const base = lower.split('-')[0]
    if (base === 'pt') return 'pt-BR'
    if (base === 'zh') return 'zh-CN'

    const partial = LANGUAGES.find(l => l.code.toLowerCase().split('-')[0] === base)
    if (partial) return partial.code
  }
  return ''
}
