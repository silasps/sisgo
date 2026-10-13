-- 163: DH dá a palavra final no pedido de obreiro que já serve em outra unidade
--
-- Até aqui (migration 134) o líder de ORIGEM aprovava ou recusava o
-- empréstimo, e a recusa encerrava o pedido. Agora a recusa do líder não
-- encerra nada: o pedido fica 'recusado_origem' (ainda em andamento,
-- aguardando o DH). Enquanto estiver em andamento ('pendente' ou
-- 'recusado_origem') o DH pode efetivar ou encerrar a qualquer momento —
-- ver decideStaffLoanAsDH em src/lib/staff-loans.ts e a página
-- /[slug]/processos. 'rejeitado' passa a ser só o encerramento pelo DH.
--
-- Colunas novas:
--   reason               observação de quem pediu (o líder pede pela tela da equipe)
--   to_ministry_role_id  função no ministério de destino a usar quando efetivar
--   dh_*                 decisão do DH (mesmo padrão de ministry_transfers, migration 068)
--
-- Tabela sem nenhuma linha em produção quando esta migration foi escrita —
-- sem dado legado pra converter.

alter table staff_loans drop constraint staff_loans_status_check;
alter table staff_loans add constraint staff_loans_status_check
  check (status in ('pendente', 'recusado_origem', 'aprovado', 'rejeitado', 'cancelado'));

alter table staff_loans
  add column reason              text,
  add column to_ministry_role_id uuid references ministry_roles(id) on delete set null,
  add column dh_reviewed_by      uuid references auth.users(id),
  add column dh_reviewed_at      timestamptz,
  add column dh_notes            text;
