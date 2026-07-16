-- 101: trilha de edição admin (quem editou o formulário e quando) e histórico
-- de avanço manual de etapa pelo DH (com justificativa obrigatória).

ALTER TABLE staff_applications
  ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE school_applications
  ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE TABLE IF NOT EXISTS pipeline_stage_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_type text NOT NULL CHECK (application_type IN ('obreiro', 'aluno')),
  application_id uuid NOT NULL,
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  reason text NOT NULL,
  advanced_by uuid REFERENCES auth.users(id),
  advanced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pipeline_stage_advances_app_idx
  ON pipeline_stage_advances(application_type, application_id);

ALTER TABLE pipeline_stage_advances ENABLE ROW LEVEL SECURITY;
