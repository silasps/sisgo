-- 030: fluxo de pagamento para refeicoes solicitadas por usuarios

ALTER TABLE kitchen_meal_consumers
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid'
    CHECK (payment_status IN ('pending','paid','cancelled','rejected')),
  ADD COLUMN IF NOT EXISTS purchase_source text NOT NULL DEFAULT 'secretaria'
    CHECK (purchase_source IN ('secretaria','self_service')),
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE kitchen_meal_consumers
SET payment_status = 'paid'
WHERE payment_status IS NULL;

CREATE INDEX IF NOT EXISTS kitchen_meal_consumers_org_payment_idx
  ON kitchen_meal_consumers (organization_id, payment_status, meal_date);
