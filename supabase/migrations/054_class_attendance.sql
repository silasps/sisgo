-- Presença por aula: registra se um aluno esteve presente em uma determinada data de aula
CREATE TABLE IF NOT EXISTS class_attendance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  person_id   uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  date        date NOT NULL,
  present     boolean NOT NULL DEFAULT true,
  notes       text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, person_id, date)
);

ALTER TABLE class_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_attendance_org_access" ON class_attendance FOR ALL USING (
  is_superadmin() OR EXISTS (
    SELECT 1 FROM school_classes sc
    JOIN schools s ON s.id = sc.school_id
    WHERE sc.id = class_id AND s.organization_id = auth_organization_id()
  )
);

CREATE INDEX IF NOT EXISTS idx_class_attendance_class_date ON class_attendance(class_id, date);
