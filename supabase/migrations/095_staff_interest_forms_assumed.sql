-- ============================================================
-- SISGO — Migration 095: DH assume pré-inscrição roteada a um ministério
-- ============================================================
--
-- Quando o líder de ministério não consegue dar andamento a tempo, o DH
-- pode assumir a conversa com o pré-inscrito. Isso não muda permissão
-- (DH já tem acesso de escrita a qualquer linha via RLS), só registra
-- quem assumiu para exibir no painel do líder e do DH.

alter table staff_interest_forms
  add column if not exists assumed_by uuid references auth.users(id) on delete set null,
  add column if not exists assumed_at timestamptz;
