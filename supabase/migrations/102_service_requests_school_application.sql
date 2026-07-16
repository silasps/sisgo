-- 102: paridade com o obreiro — permite ligar uma service_request (hospedagem
-- do aluno) a uma school_application, igual a migration 099 fez pra staff_applications.

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS school_application_id uuid REFERENCES school_applications(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS service_requests_school_application_idx
  ON service_requests (school_application_id);
