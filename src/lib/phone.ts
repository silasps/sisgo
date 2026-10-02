// Formato padrão de telefone salvo em person_contacts.value a partir de
// agora: "+<ddi> <número só dígitos>" (ex. "+55 18997255572") — produzido
// pelo componente PhoneInput (components/ui/PhoneInput.tsx). O "+ddi" no
// início é o que permite filtrar/agrupar por país depois em relatório, sem
// precisar de coluna nova na tabela (não é um dado que já existisse: dados
// antigos ficam só com dígitos, sem "+", tratados como Brasil por padrão).
const STRUCTURED_PHONE_RE = /^\+\d{1,4} \d{8,13}$/

export function validatePhoneValue(raw: string): { value: string } | { error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: '' }
  if (!STRUCTURED_PHONE_RE.test(trimmed)) return { error: 'Telefone inválido — selecione o DDI e informe o número.' }
  return { value: trimmed }
}

// Dígitos prontos pro link wa.me — aceita tanto o formato novo (com "+ddi")
// quanto dado legado (só dígitos nacionais, sem DDI, assumido Brasil).
export function whatsappDigits(phone: string): string {
  const hasDdi = phone.trim().startsWith('+')
  const digits = phone.replace(/\D/g, '')
  if (hasDdi) return digits
  return digits.length <= 11 ? `55${digits}` : digits
}
