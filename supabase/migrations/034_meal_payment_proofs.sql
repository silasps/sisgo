-- 034: comprovantes de pagamento para pedidos de refeicao

ALTER TABLE kitchen_meal_consumers
  ADD COLUMN IF NOT EXISTS payment_proof_path text,
  ADD COLUMN IF NOT EXISTS payment_proof_name text,
  ADD COLUMN IF NOT EXISTS payment_proof_mime text,
  ADD COLUMN IF NOT EXISTS payment_proof_uploaded_at timestamptz;

CREATE INDEX IF NOT EXISTS kitchen_meal_consumers_payment_proof_idx
  ON kitchen_meal_consumers (organization_id, payment_status, payment_proof_uploaded_at);
