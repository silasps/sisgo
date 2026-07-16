-- 104: autoria de pré-inscrições criadas por líder/DH (não pelo formulário
-- público) — usado para sinalizar "convite direto" na listagem de /inscricoes.

ALTER TABLE staff_interest_forms
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
