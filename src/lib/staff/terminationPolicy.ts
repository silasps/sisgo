// ─────────────────────────────────────────────────────────────────────────
// POLÍTICA DE RETENÇÃO — DESLIGAMENTO DE OBREIRO/VOLUNTÁRIO
// ─────────────────────────────────────────────────────────────────────────
// Escolha provisória, baseada em prática comum de mercado (analogia ao
// prazo trabalhista brasileiro — CLT, 5 anos — e à prescrição civil geral,
// Código Civil art. 206 §3º). NÃO é parecer jurídico. Fica documentado
// aqui de propósito como pendência: revisar com advogado especializado em
// LGPD antes de este prazo virar definitivo — é um padrão usado por TODAS
// as organizações do SISGO, não só uma base, então o risco de errado se
// multiplica.
//
// Fundamento (LGPD, informativo — não substitui análise jurídica): o
// art. 18 dá à pessoa direito de pedir eliminação dos dados, mas o art. 16
// permite reter quando necessário para (I) cumprimento de obrigação legal/
// regulatória ou (IV) uso exclusivo do controlador com acesso de terceiro
// vedado — o que inclui o período razoável de defesa em eventual
// reclamação judicial/administrativa post-desligamento.
//
// O QUE ESTÁ IMPLEMENTADO: ao desligar, o acesso é revogado na hora e o
// registro do desligamento é criado com `retained_until` calculado a
// partir daqui.
//
// O QUE NÃO ESTÁ IMPLEMENTADO (pendência futura, de propósito — ver
// conversa que originou isso): nenhum job automático apaga ou anonimiza
// dado quando `retained_until` vence. Isso exige decisão humana (e
// idealmente jurídica) sobre QUAIS campos especificamente podem ser
// removidos/anonimizados e quais devem continuar (ex.: contato de
// emergência, histórico de segurança) — não deve ser automatizado sem
// esse crivo.
export const TERMINATION_RETENTION_YEARS = 5

export function computeRetainedUntil(from: Date = new Date()): string {
  const until = new Date(from)
  until.setFullYear(until.getFullYear() + TERMINATION_RETENTION_YEARS)
  return until.toISOString().slice(0, 10)
}

export const TERMINATION_REASON_LABELS: Record<string, string> = {
  mudanca_cidade: 'Mudança de cidade',
  motivos_pessoais_familiares: 'Motivos pessoais/familiares',
  motivos_financeiros: 'Motivos financeiros',
  conflito_interpessoal: 'Conflito interpessoal',
  questao_disciplinar: 'Questão disciplinar',
  fim_do_compromisso: 'Fim do compromisso/temporada',
  saude: 'Saúde',
  outro: 'Outro',
}
