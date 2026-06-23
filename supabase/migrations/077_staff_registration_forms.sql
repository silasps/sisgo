-- ============================================================
-- SISGO — Migration 077: Pipeline de inscrição de obreiros
--   - staff_interest_forms (pré-inscrição pública)
--   - staff_applications ganha form_data, token, current_section
--   - reference_forms ganha staff_application_id (reuso)
-- ============================================================

-- ── 1. staff_interest_forms ──────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_interest_forms (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ministry_id     uuid        REFERENCES ministries(id) ON DELETE SET NULL,
  person_id       uuid        REFERENCES people(id),
  full_name       text        NOT NULL,
  email           text        NOT NULL,
  phone           text,
  phone_country   text,
  language        text,
  message         text,
  status          text        NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','formulario_enviado','em_contato','em_analise','convertido','descartado')),
  refusal_reason  text,
  reviewed_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  notified_at     timestamptz,
  responded_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_interest_forms_org_idx
  ON staff_interest_forms(organization_id);

CREATE INDEX IF NOT EXISTS staff_interest_forms_status_idx
  ON staff_interest_forms(organization_id, status);

ALTER TABLE staff_interest_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_interest_forms - public insert" ON staff_interest_forms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "staff_interest_forms - management select" ON staff_interest_forms
  FOR SELECT USING (
    auth_role() IN ('superadmin','admin_base','lider_base','dh','hospitalidade','secretaria','lider_eted','lider_ministerio')
    AND (
      auth_role() = 'superadmin'
      OR organization_id = auth_organization_id()
    )
  );

CREATE POLICY "staff_interest_forms - management update" ON staff_interest_forms
  FOR UPDATE USING (
    auth_role() IN ('superadmin','admin_base','lider_base','dh','hospitalidade','secretaria','lider_eted','lider_ministerio')
    AND (
      auth_role() = 'superadmin'
      OR organization_id = auth_organization_id()
    )
  );

-- ── 2. staff_applications: colunas de formulário ─────────────

ALTER TABLE staff_applications
  ADD COLUMN IF NOT EXISTS interest_form_id uuid REFERENCES staff_interest_forms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS form_data jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS current_section int NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS staff_applications_token_idx
  ON staff_applications(token);

CREATE INDEX IF NOT EXISTS staff_applications_interest_form_idx
  ON staff_applications(interest_form_id);

-- RLS: acesso por token (sem auth) para preenchimento do formulário
CREATE POLICY "staff_applications - token select" ON staff_applications
  FOR SELECT USING (
    token IS NOT NULL
    AND token = current_setting('request.jwt.claims', true)::jsonb ->> 'token'
  );

CREATE POLICY "staff_applications - token update" ON staff_applications
  FOR UPDATE USING (
    token IS NOT NULL
    AND status IN ('rascunho', 'enviado')
  );

-- ── 3. reference_forms: suporte a obreiros ───────────────────

ALTER TABLE reference_forms
  ADD COLUMN IF NOT EXISTS staff_application_id uuid REFERENCES staff_applications(id) ON DELETE CASCADE;

ALTER TABLE reference_forms
  ALTER COLUMN school_application_id DROP NOT NULL;

ALTER TABLE reference_forms
  DROP CONSTRAINT IF EXISTS reference_forms_exactly_one_application;

ALTER TABLE reference_forms
  ADD CONSTRAINT reference_forms_exactly_one_application
  CHECK (
    (school_application_id IS NOT NULL AND staff_application_id IS NULL)
    OR (school_application_id IS NULL AND staff_application_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS reference_forms_staff_app_idx
  ON reference_forms(staff_application_id, type);
