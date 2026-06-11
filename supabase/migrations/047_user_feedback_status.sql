ALTER TABLE user_feedback
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo', 'em_andamento', 'feito', 'descartado'));

-- remove linha de teste
DELETE FROM user_feedback WHERE page_path = '/test';
