-- ============================================================
-- SISGO — Migration 121: Pesquisa de satisfação do Seminário
--   de Hospitalidade (formulário público + respostas no admin)
-- ============================================================

CREATE TABLE IF NOT EXISTS hospitality_seminar_survey_responses (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  respondent_name         text,
  experience_feedback     text        NOT NULL,
  favorite_class_feedback text        NOT NULL,
  improvement_suggestion  text        NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hospitality_seminar_survey_responses_org_idx
  ON hospitality_seminar_survey_responses(organization_id, created_at DESC);

ALTER TABLE hospitality_seminar_survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospitality_seminar_survey_responses - public insert" ON hospitality_seminar_survey_responses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "hospitality_seminar_survey_responses - management select" ON hospitality_seminar_survey_responses
  FOR SELECT USING (
    auth_role() IN ('superadmin','admin_base','lider_base','dh','hospitalidade')
    AND (
      auth_role() = 'superadmin'
      OR organization_id = auth_organization_id()
    )
  );
