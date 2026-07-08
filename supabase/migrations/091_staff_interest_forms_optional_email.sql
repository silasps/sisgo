-- ============================================================
-- SISGO — Migration 091: e-mail opcional em staff_interest_forms
--   Contato mínimo passa a ser "e-mail OU telefone" (validado na
--   aplicação), então a coluna email não pode mais ser NOT NULL.
-- ============================================================

ALTER TABLE staff_interest_forms
  ALTER COLUMN email DROP NOT NULL;
