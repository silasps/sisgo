// Cálculo do valor de hospedagem de turmas com diária (school_classes.daily_rate)
// — usado tanto na tela de pagamento do formulário (cliente) quanto ao
// anexar o comprovante (servidor, que grava o valor esperado pra equipe
// conferir). Diária = uma noite com todas as refeições; o valor base da
// turma (base_cost) é o pacote do período completo por pessoa e funciona
// como teto: quem chega antes do início (ex: na véspera, dia oficial de
// chegada) não paga mais que o pacote.

export type LodgingPricing = { dailyRate: number; packageCap: number | null }

export type LodgingTotal = {
  nights: number
  people: number
  perPerson: number
  total: number
  capped: boolean
}

// Noites entre as datas (YYYY-MM-DD). Chegada e saída no mesmo dia conta 1
// diária. Null quando falta data ou a saída é antes da chegada.
export function countNights(arrival?: string | null, departure?: string | null): number | null {
  if (!arrival || !departure) return null
  const a = Date.parse(`${arrival.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${departure.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null
  return Math.max(1, Math.round((b - a) / 86_400_000))
}

export function computeLodgingTotal(
  pricing: LodgingPricing,
  stay: { arrival?: string | null; departure?: string | null; people: number },
): LodgingTotal | null {
  const nights = countNights(stay.arrival, stay.departure)
  if (nights == null) return null
  const raw = nights * pricing.dailyRate
  const capped = pricing.packageCap != null && raw > pricing.packageCap
  const perPerson = capped ? pricing.packageCap! : raw
  return { nights, people: stay.people, perPerson, total: perPerson * stay.people, capped }
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
