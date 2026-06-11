-- ════════════════════════════════════════════════════════════════════
-- 048 · Finance Sprints A→D: tabela de valores, cobranças, contas a pagar
-- ════════════════════════════════════════════════════════════════════

-- ── Tabela de Valores ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_price_tables (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  period_start    date        NOT NULL,
  period_end      date        NOT NULL,
  active          boolean     NOT NULL DEFAULT true,
  notes           text,
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_price_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id        uuid        NOT NULL REFERENCES finance_price_tables(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category        text        NOT NULL,
  description     text        NOT NULL,
  unit_type       text        NOT NULL DEFAULT 'monthly', -- monthly | unit | daily
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  sort_order      int         NOT NULL DEFAULT 0
);

-- ── Cobranças por Pessoa ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_charges (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id           uuid        REFERENCES people(id),
  person_name_snapshot text,
  description         text        NOT NULL,
  amount              numeric(12,2) NOT NULL,
  due_date            date        NOT NULL,
  status              text        NOT NULL DEFAULT 'pending',
  -- pending | paid | overdue | waived | cancelled
  origin              text        NOT NULL DEFAULT 'manual',
  -- manual | school_fee | housing | meal_plan | tax | batch
  reference_month     text,       -- YYYY-MM
  price_item_id       uuid        REFERENCES finance_price_items(id),
  notes               text,
  paid_at             timestamptz,
  paid_by             uuid        REFERENCES auth.users(id),
  created_by          uuid        REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Contas a Pagar ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_payables (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description     text        NOT NULL,
  supplier        text,
  amount          numeric(12,2) NOT NULL,
  due_date        date        NOT NULL,
  recurrence      text        NOT NULL DEFAULT 'once', -- once | monthly | annual
  category_id     uuid        REFERENCES finance_categories(id),
  fund_id         uuid        REFERENCES finance_funds(id),
  status          text        NOT NULL DEFAULT 'pending',
  -- pending | paid | overdue | cancelled
  notes           text,
  paid_at         timestamptz,
  paid_by         uuid        REFERENCES auth.users(id),
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_finance_price_tables_org ON finance_price_tables(organization_id);
CREATE INDEX IF NOT EXISTS idx_finance_price_items_table ON finance_price_items(table_id);
CREATE INDEX IF NOT EXISTS idx_finance_charges_org_status ON finance_charges(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_finance_charges_person ON finance_charges(person_id);
CREATE INDEX IF NOT EXISTS idx_finance_payables_org_status ON finance_payables(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_finance_payables_due ON finance_payables(organization_id, due_date);

-- ── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE finance_price_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_price_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_charges      ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_payables     ENABLE ROW LEVEL SECURITY;

-- Price Tables: organização pode gerenciar
CREATE POLICY "finance_price_tables_org" ON finance_price_tables
  USING (organization_id IN (SELECT id FROM organizations));

CREATE POLICY "finance_price_items_org" ON finance_price_items
  USING (organization_id IN (SELECT id FROM organizations));

CREATE POLICY "finance_charges_org" ON finance_charges
  USING (organization_id IN (SELECT id FROM organizations));

CREATE POLICY "finance_payables_org" ON finance_payables
  USING (organization_id IN (SELECT id FROM organizations));
