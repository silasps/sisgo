import {
  Users, MessageSquare, CalendarDays, GraduationCap, Wallet,
  Home, UtensilsCrossed, Music, IdCard, WashingMachine,
} from 'lucide-react'

export const MODULE_LABELS: Record<string, { label: string; icon: typeof Users }> = {
  pessoas:     { label: 'Pessoas',                  icon: Users },
  comunicacao: { label: 'Comunicação',               icon: MessageSquare },
  calendario:  { label: 'Calendário e presença',     icon: CalendarDays },
  escolas:     { label: 'Escolas e inscrições',      icon: GraduationCap },
  financeiro:  { label: 'Financeiro',                icon: Wallet },
  hospedagem:  { label: 'Hospedagem e reservas',     icon: Home },
  cozinha:     { label: 'Cozinha',                   icon: UtensilsCrossed },
  ministerios: { label: 'Ministérios',                icon: Music },
  carteirinha: { label: 'Carteirinha digital',       icon: IdCard },
  lavanderia:  { label: 'Lavanderia',                icon: WashingMachine },
}

// Ordem de exibição na tabela de comparação (categorias, do essencial ao completo)
export const MODULE_ORDER = [
  'pessoas', 'comunicacao', 'calendario',
  'escolas', 'financeiro',
  'hospedagem', 'cozinha', 'ministerios',
  'carteirinha', 'lavanderia',
]

export function moduleLabel(key: string): string {
  return MODULE_LABELS[key]?.label ?? key
}

export const PRICING_FAQ = [
  {
    q: 'Preciso de cartão de crédito para testar?',
    a: 'Não. O trial de 30 dias começa assim que você cria sua conta, sem nenhum dado de pagamento.',
  },
  {
    q: 'O que conta como "pessoa" no limite do plano?',
    a: 'Alunos e obreiros/equipe cadastrados na sua organização, juntos — não é preciso ter login no sistema para contar.',
  },
  {
    q: 'Posso mudar de plano depois?',
    a: 'Sim. Você pode subir de plano a qualquer momento conforme sua organização cresce.',
  },
  {
    q: 'A plataforma é só para a JOCUM?',
    a: 'Não. O sistema foi construído para qualquer organização missionária que precise gerenciar pessoas, escolas e operações em uma ou mais bases.',
  },
]
