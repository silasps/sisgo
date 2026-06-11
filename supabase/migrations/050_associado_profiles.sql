-- ============================================================
-- 050: Perfil de Associado (taxa de ligação)
-- ============================================================

-- Role associado no sistema
INSERT INTO roles (name, label, description)
VALUES ('associado', 'Associado', 'Membro associado da base — acessa reservas e minhas contas')
ON CONFLICT (name) DO NOTHING;

-- Tabela de perfis de associados (similar a staff_profiles)
CREATE TABLE IF NOT EXISTS associado_profiles (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id       uuid        NOT NULL UNIQUE REFERENCES people(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES auth.users(id),
  active          boolean     NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE associado_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "associado_profiles_org" ON associado_profiles
  FOR ALL USING (
    is_superadmin() OR organization_id = auth_organization_id()
  );

CREATE POLICY "associado_profiles_self" ON associado_profiles
  FOR SELECT USING (user_id = auth.uid());

-- Associados podem ver as próprias cobranças
CREATE POLICY "finance_charges_self_associado" ON finance_charges
  FOR SELECT USING (
    person_id IN (
      SELECT ap.person_id FROM associado_profiles ap
      WHERE ap.user_id = auth.uid() AND ap.active = true
    )
  );

-- Permite category 'associado' nas fee_rules
ALTER TABLE finance_fee_rules
  DROP CONSTRAINT IF EXISTS finance_fee_rules_person_category_check;

ALTER TABLE finance_fee_rules
  ADD CONSTRAINT finance_fee_rules_person_category_check
  CHECK (person_category IN ('obreiro', 'aluno', 'associado'));

CREATE INDEX IF NOT EXISTS idx_associado_profiles_org ON associado_profiles(organization_id, active);
CREATE INDEX IF NOT EXISTS idx_associado_profiles_user ON associado_profiles(user_id);
