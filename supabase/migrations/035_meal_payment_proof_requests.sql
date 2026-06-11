-- 035: solicitacao de comprovante de pagamento para refeicoes

ALTER TABLE kitchen_meal_consumers
  ADD COLUMN IF NOT EXISTS payment_proof_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_proof_requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_proof_request_message text;

CREATE INDEX IF NOT EXISTS kitchen_meal_consumers_payment_proof_request_idx
  ON kitchen_meal_consumers (organization_id, payment_status, payment_proof_requested_at);
