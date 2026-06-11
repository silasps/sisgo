-- Tabela para sugestões enviadas pelos usuários via botão de feedback no admin
CREATE TABLE IF NOT EXISTS user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  page_path text NOT NULL,
  page_label text,
  suggestion text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Somente service_role tem acesso total
CREATE POLICY "service_role_all" ON user_feedback
  USING (true)
  WITH CHECK (true);
