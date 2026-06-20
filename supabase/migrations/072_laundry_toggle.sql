-- 072: toggle para ativar/desativar módulo de lavanderia por organização

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS laundry_enabled boolean NOT NULL DEFAULT false;
