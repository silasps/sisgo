-- ============================================================
-- 052: Presença de Pessoas na Base (Check-in / Check-out)
-- ============================================================

CREATE TABLE IF NOT EXISTS person_presence (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id       uuid        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  checked_out_at  timestamptz,
  checked_in_by   uuid        REFERENCES auth.users(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE person_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presence_org_access" ON person_presence
  FOR ALL USING (
    is_superadmin() OR organization_id = auth_organization_id()
  );

CREATE INDEX IF NOT EXISTS idx_person_presence_org     ON person_presence(organization_id, checked_out_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_person_presence_person  ON person_presence(person_id);
CREATE INDEX IF NOT EXISTS idx_person_presence_date    ON person_presence(organization_id, checked_in_at DESC);
