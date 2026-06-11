-- 033: cobrancas pix automaticas de refeicoes

CREATE TABLE IF NOT EXISTS kitchen_meal_payment_charges (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_group_id  uuid NOT NULL,
  provider           text NOT NULL,
  provider_charge_id text,
  amount             numeric(10,2) NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','cancelled','expired')),
  pix_copy_paste     text,
  pix_qr_code_base64 text,
  invoice_url        text,
  expires_at         timestamptz,
  raw_response       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, purchase_group_id)
);

CREATE INDEX IF NOT EXISTS kitchen_meal_payment_charges_org_status_idx
  ON kitchen_meal_payment_charges (organization_id, status, created_at DESC);

ALTER TABLE kitchen_meal_payment_charges ENABLE ROW LEVEL SECURITY;
