-- 164: OK final sempre do DH + tipo da movimentação (acúmulo x transferência)
--
-- Pedido de obreiro (staff_loans, migrations 134/163): o líder ATUAL da
-- pessoa responde, mas a resposta dele não efetiva mais nada — aceitar vira
-- 'aceito_origem' e recusar vira 'recusado_origem', e nos dois casos quem dá
-- o OK final é o DH (decideStaffLoanAsDH em src/lib/staff-loans.ts, tela
-- /[slug]/processos). No OK o DH configura como a pessoa vai servir:
--   • acumulo       — continua onde está e passa a servir também no destino
--   • transferencia — sai da unidade de origem e passa a servir só no destino
-- Quem pede já escolhe o tipo; o DH pode trocar na hora do OK.
--
-- Acúmulo de funções pode não ter prazo e transferência não tem fim, por
-- isso ends_on deixa de ser obrigatório (era só informativo: nada encerra o
-- empréstimo automaticamente na data).
--
-- Transferência entre ministérios (ministry_transfers, migration 068) ganha
-- o mesmo campo: o DH também escolhe no OK final se a pessoa sai da origem
-- ou acumula. E a recusa do líder de destino ('rejeitado_destino') passa a
-- esperar a decisão do DH em vez de encerrar — o encerramento é 'rejeitado_dh'.
--
-- Sem linhas em produção em nenhuma das duas tabelas quando esta migration
-- foi escrita — nada legado pra converter.

alter table staff_loans drop constraint staff_loans_status_check;
alter table staff_loans add constraint staff_loans_status_check
  check (status in ('pendente', 'aceito_origem', 'recusado_origem', 'aprovado', 'rejeitado', 'cancelado'));

alter table staff_loans
  add column move_type text not null default 'acumulo' check (move_type in ('acumulo', 'transferencia'));

alter table staff_loans alter column ends_on drop not null;

alter table ministry_transfers
  add column move_type text not null default 'transferencia' check (move_type in ('acumulo', 'transferencia'));
