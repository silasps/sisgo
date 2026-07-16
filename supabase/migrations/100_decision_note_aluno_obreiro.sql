-- 100: palavra opcional do líder ao decidir aceitar/recusar — aluno e obreiro
-- A nota é registrada no momento da decisão do líder, mas só é enviada ao
-- proponente junto do e-mail que já comunica o desfecho definitivo
-- (aceito/recusado), nunca como aviso solto/intermediário.

ALTER TABLE student_applications
  ADD COLUMN IF NOT EXISTS decision_note text,
  ADD COLUMN IF NOT EXISTS decision_note_shared boolean NOT NULL DEFAULT false;

ALTER TABLE school_interest_forms
  ADD COLUMN IF NOT EXISTS decision_note text,
  ADD COLUMN IF NOT EXISTS decision_note_shared boolean NOT NULL DEFAULT false;

ALTER TABLE staff_applications
  ADD COLUMN IF NOT EXISTS leader_word text,
  ADD COLUMN IF NOT EXISTS leader_word_shared boolean NOT NULL DEFAULT false;
