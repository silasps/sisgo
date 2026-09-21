import {
  GraduationCap, Users, Wallet, UtensilsCrossed, Home,
  Music, CalendarDays,
} from 'lucide-react'

export const STATS = [
  { value: 'Multi', label: 'organização — uma plataforma' },
  { value: '10+',  label: 'módulos integrados' },
  { value: '100%', label: 'contexto missionário' },
  { value: 'Real', label: 'time — sempre atualizado' },
]

export const FEATURES_BIG = [
  {
    icon: GraduationCap,
    title: 'Escolas e inscrições',
    desc: 'Gerencie escolas de treinamento e de segundo nível com turmas, presenças, atividades, certificados e todo o fluxo de inscrição — do formulário público até a aprovação do candidato.',
  },
  {
    icon: Users,
    title: 'Pessoas e equipe',
    desc: 'Cadastro completo de toda a comunidade da organização: alunos, obreiros, voluntários e associados. Perfis com saúde, documentos e histórico centralizado em um só lugar.',
  },
]

export const FEATURES_MID = [
  {
    icon: Wallet,
    title: 'Financeiro',
    desc: 'Cobranças, contas a pagar, relatórios e controle de caixa por área — tudo com visibilidade por perfil de acesso.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Cozinha',
    desc: 'Cardápio, estoque, refeições flexíveis e pagamentos integrados. Do pedido à comprovação, sem papel.',
  },
  {
    icon: Home,
    title: 'Reservas',
    desc: 'Quartos e instalações com formulário customizável, aprovações e controle de disponibilidade.',
  },
]

export const FEATURES_SMALL = [
  {
    icon: Music,
    title: 'Ministérios',
    desc: 'Organize equipes, líderes e membros com solicitações e pendências automatizadas.',
  },
  {
    icon: CalendarDays,
    title: 'Calendário e presença',
    desc: 'Eventos, aulas e controle de presença com lançamento de faltas e declarações.',
  },
]

export const STEPS = [
  {
    title: 'Crie sua conta',
    desc: 'Cadastre-se com e-mail ou Google em segundos. Sem cartão de crédito, sem burocracia.',
  },
  {
    title: 'Explore as organizações',
    desc: 'Navegue pelas organizações missionárias cadastradas e conheça as escolas e programas disponíveis.',
  },
  {
    title: 'Faça sua inscrição',
    desc: 'Candidate-se como aluno, obreiro ou voluntário diretamente pelo sistema.',
  },
]
