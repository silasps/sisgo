-- 037: remove da fila ativa pagamentos de refeicao ja recusados

UPDATE kitchen_meal_consumers
SET
  payment_status = 'rejected',
  payment_proof_requested_at = NULL,
  payment_proof_requested_by = NULL,
  payment_proof_request_message = NULL,
  updated_at = now()
WHERE payment_status = 'pending'
  AND payment_rejected_at IS NOT NULL;
