-- ============================================================
-- SISGO — Migration 008: Internacionalização do formulário de pré-inscrição
-- ============================================================

ALTER TABLE school_interest_forms
  ADD COLUMN IF NOT EXISTS language          text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phone_country     text DEFAULT NULL;
-- phone_country: ex: "+55", "+1", "+44" (armazenado separado do número para facilitar exibição)
-- language: ex: "pt-BR", "en", "es"
