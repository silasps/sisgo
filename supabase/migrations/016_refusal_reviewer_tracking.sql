-- ============================================================
-- SISGO — Rastreio de quem recusou inscrições
-- ============================================================

alter table school_interest_forms
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table staff_applications
  add column if not exists refusal_reason text default null;
