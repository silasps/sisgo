-- 040: caixas proprios por ETED/escola ou ministerio
-- Importante: caixa de ETED/escola fica vinculado a schools.id, nunca a turmas.

CREATE TABLE IF NOT EXISTS finance_cash_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('school', 'ministry')),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  ministry_id uuid REFERENCES ministries(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  include_in_base_available boolean NOT NULL DEFAULT false,
  name_snapshot text,
  notes text,
  configured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  configured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (entity_type = 'school' AND school_id IS NOT NULL AND ministry_id IS NULL)
    OR
    (entity_type = 'ministry' AND ministry_id IS NOT NULL AND school_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_cash_scopes_school_unique
  ON finance_cash_scopes (organization_id, school_id)
  WHERE entity_type = 'school';

CREATE UNIQUE INDEX IF NOT EXISTS finance_cash_scopes_ministry_unique
  ON finance_cash_scopes (organization_id, ministry_id)
  WHERE entity_type = 'ministry';

CREATE INDEX IF NOT EXISTS finance_cash_scopes_org_enabled_idx
  ON finance_cash_scopes (organization_id, enabled, entity_type);

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS cash_scope_id uuid REFERENCES finance_cash_scopes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS financial_transactions_cash_scope_idx
  ON financial_transactions (organization_id, cash_scope_id, date DESC);

DO $$
BEGIN
  ALTER TABLE finance_cash_scopes ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_cash_scopes'
      AND policyname = 'finance cash scopes full read'
  ) THEN
    CREATE POLICY "finance cash scopes full read" ON finance_cash_scopes
      FOR SELECT USING (
        finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria'])
        OR finance_is_school_leader(organization_id, school_id)
        OR finance_is_ministry_leader(organization_id, ministry_id)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_cash_scopes'
      AND policyname = 'finance cash scopes base configure'
  ) THEN
    CREATE POLICY "finance cash scopes base configure" ON finance_cash_scopes
      FOR ALL
      USING (finance_has_role(organization_id, ARRAY['superadmin','lider_base']))
      WITH CHECK (finance_has_role(organization_id, ARRAY['superadmin','lider_base']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_transactions'
      AND policyname = 'financial transactions area cash manage'
  ) THEN
    CREATE POLICY "financial transactions area cash manage" ON financial_transactions
      FOR ALL
      USING (
        cash_scope_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM finance_cash_scopes fcs
          WHERE fcs.id = cash_scope_id
            AND fcs.organization_id = financial_transactions.organization_id
            AND fcs.enabled = true
            AND (
              finance_is_school_leader(fcs.organization_id, fcs.school_id)
              OR finance_is_ministry_leader(fcs.organization_id, fcs.ministry_id)
            )
        )
      )
      WITH CHECK (
        cash_scope_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM finance_cash_scopes fcs
          WHERE fcs.id = cash_scope_id
            AND fcs.organization_id = financial_transactions.organization_id
            AND fcs.enabled = true
            AND (
              finance_is_school_leader(fcs.organization_id, fcs.school_id)
              OR finance_is_ministry_leader(fcs.organization_id, fcs.ministry_id)
            )
        )
      );
  END IF;
END $$;
