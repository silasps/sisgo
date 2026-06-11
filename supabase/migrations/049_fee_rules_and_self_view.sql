-- ============================================================
-- 049: Regras de taxa mensal + auto-view para obreiros
-- ============================================================

-- Regras de cobrança automática por categoria de pessoa
CREATE TABLE IF NOT EXISTS finance_fee_rules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_category text        NOT NULL CHECK (person_category IN ('obreiro', 'aluno')),
  description     text        NOT NULL,
  amount          numeric(12,2) NOT NULL CHECK (amount >= 0),
  price_item_id   uuid        REFERENCES finance_price_items(id) ON DELETE SET NULL,
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE finance_fee_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_rules_org" ON finance_fee_rules
  FOR ALL USING (
    is_superadmin() OR organization_id = auth_organization_id()
  );

-- Obreiros e alunos podem ver as próprias cobranças (via staff_profiles / student_profiles)
CREATE POLICY "finance_charges_self_staff" ON finance_charges
  FOR SELECT USING (
    person_id IN (
      SELECT sp.person_id FROM staff_profiles sp
      WHERE sp.user_id = auth.uid() AND sp.active = true
    )
  );

CREATE POLICY "finance_charges_self_student" ON finance_charges
  FOR SELECT USING (
    person_id IN (
      SELECT st.person_id FROM student_profiles st
      WHERE st.user_id = auth.uid() AND st.active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_fee_rules_org ON finance_fee_rules(organization_id, active);
