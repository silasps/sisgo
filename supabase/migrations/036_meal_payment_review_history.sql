-- 036: historico de analise de pagamento de refeicoes

ALTER TABLE kitchen_meal_consumers
  ADD COLUMN IF NOT EXISTS payment_rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_rejection_reason text;

CREATE TABLE IF NOT EXISTS kitchen_meal_payment_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_group_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('proof_requested', 'payment_rejected')),
  reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kitchen_meal_payment_reviews_purchase_idx
  ON kitchen_meal_payment_reviews (organization_id, purchase_group_id, reviewed_at DESC);
