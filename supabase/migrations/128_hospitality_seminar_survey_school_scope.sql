-- ============================================================
-- SISGO — Migration 128: Escopa a pesquisa de satisfação por
--   escola (a pesquisa passa a viver como aba dentro de cada
--   escola/seminário em vez de item solto no menu)
-- ============================================================

ALTER TABLE hospitality_seminar_survey_responses
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;

ALTER TABLE hospitality_seminar_survey_responses
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS hospitality_seminar_survey_responses_school_idx
  ON hospitality_seminar_survey_responses(school_id, created_at DESC);

DROP POLICY IF EXISTS "hospitality_seminar_survey_responses - management select" ON hospitality_seminar_survey_responses;

CREATE POLICY "hospitality_seminar_survey_responses - management select" ON hospitality_seminar_survey_responses
  FOR SELECT USING (
    auth_role() IN ('superadmin','admin_base','lider_base','dh','lider_eted')
    AND (
      auth_role() = 'superadmin'
      OR organization_id = auth_organization_id()
    )
  );
