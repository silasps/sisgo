-- ============================================================
-- SISGO — Rastreio de quem aceitou alunos
-- ============================================================

alter table student_profiles
  add column if not exists accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists accepted_at timestamptz;
