-- 103: data de saída prevista (opcional) — informada pelo líder junto com a
-- chegada, ou definida depois (obreiros podem ser permanentes).
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS requested_departure_date date;
