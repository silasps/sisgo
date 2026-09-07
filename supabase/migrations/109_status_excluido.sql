-- ============================================================
-- SISGO — Migration 109: status 'excluido' distinto de recusa
-- ============================================================
--
-- Até aqui, "sair do processo" só tinha um status por tabela
-- ('descartado' nas de pré-inscrição, 'reprovado' nas de candidatura
-- completa), usado tanto pra recusa avaliada quanto pra exclusão de
-- cadastro por engano/duplicata. Passa a existir 'excluido' como status
-- próprio pras duas coisas ficarem distinguíveis no banco (não só no
-- texto do motivo) — sem apagar nenhum registro, mesma regra de sempre.

alter table school_interest_forms drop constraint if exists school_interest_forms_status_check;
alter table school_interest_forms add constraint school_interest_forms_status_check
  check (status in ('pendente','formulario_enviado','em_contato','em_analise','convertido','descartado','excluido'));

alter table staff_interest_forms drop constraint if exists staff_interest_forms_status_check;
alter table staff_interest_forms add constraint staff_interest_forms_status_check
  check (status in ('pendente','formulario_enviado','em_contato','em_analise','convertido','descartado','excluido'));

alter table student_applications drop constraint if exists student_applications_status_check;
alter table student_applications add constraint student_applications_status_check
  check (status in ('pendente','em_analise','aprovado','reprovado','cancelado','excluido'));

alter table staff_applications drop constraint if exists staff_applications_status_check;
alter table staff_applications add constraint staff_applications_status_check
  check (status in ('rascunho','enviado','pendente','em_analise','aprovado','reprovado','cancelado','excluido'));
