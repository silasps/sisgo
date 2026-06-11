-- ============================================================
-- 053: Ficha de Saúde de Pessoas
-- ============================================================

CREATE TABLE IF NOT EXISTS person_health_info (
  id                       uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id                uuid  NOT NULL UNIQUE REFERENCES people(id) ON DELETE CASCADE,
  blood_type               text,
  allergies                text,
  medications              text,
  health_conditions        text,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE person_health_info ENABLE ROW LEVEL SECURITY;

-- Apenas gestores, DH e secretaria podem ver fichas de saúde
CREATE POLICY "health_info_restricted" ON person_health_info
  FOR ALL USING (
    is_superadmin()
    OR (
      organization_id = auth_organization_id()
      AND auth_role() IN ('admin_base', 'lider_base', 'dh', 'secretaria', 'lider_eted')
    )
  );

CREATE TRIGGER set_updated_at_person_health_info
  BEFORE UPDATE ON person_health_info
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_person_health_info_org    ON person_health_info(organization_id);
CREATE INDEX IF NOT EXISTS idx_person_health_info_person ON person_health_info(person_id);
