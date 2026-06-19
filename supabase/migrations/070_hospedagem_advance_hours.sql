-- 070: prazo de antecedência para mostrar reservas no mapa de camas

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS hospedagem_advance_hours int NOT NULL DEFAULT 120;
