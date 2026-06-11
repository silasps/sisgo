-- 023: respostas de campos personalizados nas reservas

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS form_answers jsonb NOT NULL DEFAULT '[]'::jsonb;
