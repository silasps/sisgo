-- ============================================================
-- SISGO — Migration 092: corrige check de status em staff_applications
-- ============================================================
--
-- A migration 077 passou a usar os status 'rascunho' e 'enviado' em
-- staff_applications (mesmo fluxo de school_applications), mas nunca
-- atualizou o CHECK constraint original (migration 001), que só permitia
-- 'pendente','em_analise','aprovado','reprovado','cancelado'. Isso quebra
-- a geração do formulário de obreiro (insert com status='rascunho') e o
-- envio do formulário preenchido (update para status='enviado').

alter table staff_applications
  drop constraint if exists staff_applications_status_check;

alter table staff_applications
  add constraint staff_applications_status_check
  check (status in ('rascunho','enviado','pendente','em_analise','aprovado','reprovado','cancelado'));
