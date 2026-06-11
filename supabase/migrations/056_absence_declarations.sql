CREATE TABLE IF NOT EXISTS absence_declarations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id       uuid        NOT NULL REFERENCES people(id)        ON DELETE CASCADE,
  start_date      date        NOT NULL,
  end_date        date        NOT NULL,
  reason_type     text        NOT NULL CHECK (reason_type IN (
                                'viagem_missionaria','ferias','saude','familia','outro')),
  reason_notes    text,
  declared_by     uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT absence_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_absence_declarations_org   ON absence_declarations (organization_id, start_date, end_date);
CREATE INDEX idx_absence_declarations_person ON absence_declarations (person_id);

ALTER TABLE absence_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY absence_declarations_org_access ON absence_declarations
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid() AND active = true
    )
  );
