-- ============================================================
-- SISGO — Migration 094: skip justificado da referência do pastor
-- ============================================================
--
-- A recomendação do pastor é obrigatória por padrão para finalizar um
-- obreiro. Em exceções (pessoa sem igreja vinculada, pastor inalcançável),
-- o DH pode pular a etapa, mas precisa registrar o motivo.

alter table staff_applications
  add column if not exists pastor_reference_skip_reason text,
  add column if not exists pastor_reference_skipped_by uuid references auth.users(id) on delete set null,
  add column if not exists pastor_reference_skipped_at timestamptz;
