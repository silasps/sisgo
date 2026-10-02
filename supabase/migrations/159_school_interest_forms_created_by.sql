-- 159: mesma autoria que 104 deu a staff_interest_forms, agora em
-- school_interest_forms — usado para sinalizar "convite direto" (líder de
-- escola manda o formulário definitivo de aluno sem pré-inscrição pública).

ALTER TABLE school_interest_forms
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
