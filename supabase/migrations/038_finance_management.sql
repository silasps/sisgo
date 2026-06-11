-- 038: financeiro por fundos, categorias e orcamentos

CREATE TABLE IF NOT EXISTS finance_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  restriction_type text NOT NULL DEFAULT 'unrestricted'
    CHECK (restriction_type IN ('unrestricted', 'designated', 'restricted')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS finance_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  fund_id uuid REFERENCES finance_funds(id) ON DELETE SET NULL,
  category_id uuid REFERENCES finance_categories(id) ON DELETE SET NULL,
  ministry_id uuid REFERENCES ministries(id) ON DELETE SET NULL,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  planned_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_expense_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fund_id uuid REFERENCES finance_funds(id) ON DELETE SET NULL,
  category_id uuid REFERENCES finance_categories(id) ON DELETE SET NULL,
  ministry_id uuid REFERENCES ministries(id) ON DELETE SET NULL,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'cancelled')),
  notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS fund_id uuid REFERENCES finance_funds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES finance_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ministry_id uuid REFERENCES ministries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS reference_code text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_finance_funds_org_active
  ON finance_funds (organization_id, active);

CREATE INDEX IF NOT EXISTS idx_finance_categories_org_type
  ON finance_categories (organization_id, type, active);

CREATE INDEX IF NOT EXISTS idx_finance_budgets_org_period
  ON finance_budgets (organization_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_finance_expense_requests_org_status
  ON finance_expense_requests (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_fund
  ON financial_transactions (organization_id, fund_id, date DESC);

INSERT INTO finance_funds (organization_id, name, description, restriction_type)
SELECT o.id, v.name, v.description, v.restriction_type
FROM organizations o
CROSS JOIN (VALUES
  ('Fundo Geral', 'Recursos livres para operação da base.', 'unrestricted'),
  ('Designado - Cozinha', 'Recursos separados para alimentação e compras da cozinha.', 'designated'),
  ('Designado - ETED', 'Recursos separados para turmas, alunos e custos da ETED.', 'designated'),
  ('Bolsas e Missionários', 'Ofertas destinadas a bolsas, obreiros e apoio missionário.', 'restricted'),
  ('Projetos Especiais', 'Campanhas e projetos com finalidade específica.', 'restricted')
) AS v(name, description, restriction_type)
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO finance_categories (organization_id, name, type)
SELECT o.id, v.name, v.type
FROM organizations o
CROSS JOIN (VALUES
  ('Ofertas e Doações', 'income'),
  ('Mensalidades e Taxas', 'income'),
  ('Refeições', 'income'),
  ('Hospedagem', 'income'),
  ('Cozinha e Mercado', 'expense'),
  ('Manutenção', 'expense'),
  ('Transporte', 'expense'),
  ('Bolsas e Apoio Missionário', 'expense'),
  ('Secretaria e Administrativo', 'expense'),
  ('Escolas e Treinamentos', 'expense'),
  ('Projetos e Evangelismo', 'both')
) AS v(name, type)
ON CONFLICT (organization_id, name) DO NOTHING;
