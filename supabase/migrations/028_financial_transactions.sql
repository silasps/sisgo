-- 028: lancamentos financeiros basicos

CREATE TABLE IF NOT EXISTS financial_transactions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description     text NOT NULL,
  amount          numeric(10,2) NOT NULL DEFAULT 0,
  type            text NOT NULL CHECK (type IN ('income', 'expense')),
  category        text,
  date            date NOT NULL DEFAULT CURRENT_DATE,
  status          text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'overdue', 'cancelled')),
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_org_date
  ON financial_transactions (organization_id, date DESC);
