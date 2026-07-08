export type ExpiryUrgency = 'vencido' | 'urgente' | 'atencao' | 'ok'

export function daysUntil(dateStr: string) {
  return Math.ceil((new Date(`${dateStr}T00:00:00`).getTime() - Date.now()) / 86400000)
}

export function expiryUrgency(daysLeft: number): ExpiryUrgency {
  if (daysLeft <= 0) return 'vencido'
  if (daysLeft <= 7) return 'urgente'
  if (daysLeft <= 30) return 'atencao'
  return 'ok'
}

export const EXPIRY_URGENCY_STYLE: Record<ExpiryUrgency, string> = {
  vencido: 'bg-red-100 text-red-700',
  urgente: 'bg-red-100 text-red-700',
  atencao: 'bg-amber-100 text-amber-700',
  ok: 'bg-gray-100 text-gray-500',
}

export function expiryLabel(daysLeft: number, urgency: ExpiryUrgency) {
  if (urgency === 'vencido') return 'Vencido'
  return `Vence em ${daysLeft}d`
}
