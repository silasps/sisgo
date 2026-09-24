-- 134: empréstimo de obreiro entre escola/ministério
--
-- Diferente de ministry_transfers (migration 068, definitivo — a pessoa sai
-- da origem): aqui a pessoa CONTINUA no vínculo de origem e passa a servir
-- também na unidade de destino por um período. Fica pendente até o líder da
-- unidade de ORIGEM validar — só aí a pessoa é de fato inserida em
-- school_staff/ministry_members do destino (ver src/lib/staff-loans.ts).

CREATE TABLE staff_loans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id         uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  from_unit_type    text NOT NULL CHECK (from_unit_type IN ('school','ministry')),
  from_school_id    uuid REFERENCES schools(id) ON DELETE CASCADE,
  from_ministry_id  uuid REFERENCES ministries(id) ON DELETE CASCADE,

  to_unit_type      text NOT NULL CHECK (to_unit_type IN ('school','ministry')),
  to_school_id      uuid REFERENCES schools(id) ON DELETE CASCADE,
  to_ministry_id    uuid REFERENCES ministries(id) ON DELETE CASCADE,

  role              text,
  starts_on         date NOT NULL,
  ends_on           date,

  requested_by      uuid NOT NULL REFERENCES auth.users(id),
  status            text NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','aprovado','rejeitado','cancelado')),
  reviewed_by       uuid REFERENCES auth.users(id),
  reviewed_at       timestamptz,
  recommendation    text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT staff_loans_from_unit_check CHECK (
    (from_unit_type = 'school'   AND from_school_id   IS NOT NULL AND from_ministry_id IS NULL) OR
    (from_unit_type = 'ministry' AND from_ministry_id IS NOT NULL AND from_school_id   IS NULL)
  ),
  CONSTRAINT staff_loans_to_unit_check CHECK (
    (to_unit_type = 'school'   AND to_school_id   IS NOT NULL AND to_ministry_id IS NULL) OR
    (to_unit_type = 'ministry' AND to_ministry_id IS NOT NULL AND to_school_id   IS NULL)
  )
);

CREATE INDEX staff_loans_org_status_idx ON staff_loans (organization_id, status);
CREATE INDEX staff_loans_person_idx ON staff_loans (person_id, status);
CREATE INDEX staff_loans_from_school_idx ON staff_loans (from_school_id, status);
CREATE INDEX staff_loans_from_ministry_idx ON staff_loans (from_ministry_id, status);

CREATE TRIGGER trg_staff_loans_updated_at
  BEFORE UPDATE ON staff_loans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Mesmo padrão de "ministry_transfers manage" (migration 068): gestão da
-- org, supervisor, quem pediu, líder de origem OU destino — estendido pra
-- cobrir líder de escola nos dois lados também (school_leaders).

ALTER TABLE staff_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_loans manage" ON staff_loans
  FOR ALL USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM organization_users ou
      JOIN roles r ON r.id = ou.role_id
      WHERE ou.user_id = auth.uid()
        AND ou.organization_id = staff_loans.organization_id
        AND ou.active = true
        AND r.name = ANY (ARRAY['admin_base','lider_base','dh'])
    )
    OR user_supervises_organization(organization_id)
    OR requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM ministry_leaders ml
      WHERE ml.user_id = auth.uid()
        AND (ml.ministry_id = staff_loans.from_ministry_id OR ml.ministry_id = staff_loans.to_ministry_id)
    )
    OR EXISTS (
      SELECT 1 FROM school_leaders sl
      WHERE sl.user_id = auth.uid()
        AND (sl.school_id = staff_loans.from_school_id OR sl.school_id = staff_loans.to_school_id)
    )
  )
  WITH CHECK (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM organization_users ou
      JOIN roles r ON r.id = ou.role_id
      WHERE ou.user_id = auth.uid()
        AND ou.organization_id = staff_loans.organization_id
        AND ou.active = true
        AND r.name = ANY (ARRAY['admin_base','lider_base','dh'])
    )
    OR user_supervises_organization(organization_id)
    OR requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM ministry_leaders ml
      WHERE ml.user_id = auth.uid()
        AND (ml.ministry_id = staff_loans.from_ministry_id OR ml.ministry_id = staff_loans.to_ministry_id)
    )
    OR EXISTS (
      SELECT 1 FROM school_leaders sl
      WHERE sl.user_id = auth.uid()
        AND (sl.school_id = staff_loans.from_school_id OR sl.school_id = staff_loans.to_school_id)
    )
  );
