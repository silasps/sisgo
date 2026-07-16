-- 099: hospedagem do obreiro vira solicitação antecipada e bloqueante
-- Permite registrar a data de chegada do obreiro a qualquer momento do
-- processo (não só após a aprovação do DH), virando uma pendência revisável
-- pela hospitalidade via service_requests. A aprovação final do DH passa a
-- exigir essa etapa resolvida (ou justificativa de skip, no mesmo padrão já
-- usado para a referência do pastor).

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS staff_application_id uuid REFERENCES staff_applications(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS requested_arrival_date date;

CREATE INDEX IF NOT EXISTS service_requests_staff_application_idx
  ON service_requests (staff_application_id);

ALTER TABLE staff_applications
  ADD COLUMN IF NOT EXISTS hospedagem_skip_reason text,
  ADD COLUMN IF NOT EXISTS hospedagem_skipped_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hospedagem_skipped_at timestamptz;
