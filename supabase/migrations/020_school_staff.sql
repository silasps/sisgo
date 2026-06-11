-- 020: equipe por escola (nível geral, independente de turma)

CREATE TABLE school_staff (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id  uuid        REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  person_id  uuid        REFERENCES people(id) ON DELETE CASCADE NOT NULL,
  role       text        NOT NULL DEFAULT 'Obreiro',
  joined_at  timestamptz DEFAULT now() NOT NULL,
  active     boolean     DEFAULT true NOT NULL,
  UNIQUE(school_id, person_id)
);

ALTER TABLE school_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view school_staff" ON school_staff
  FOR SELECT
  USING (
    school_id IN (
      SELECT id FROM schools
      WHERE organization_id IN (
        SELECT organization_id FROM organization_users
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );
