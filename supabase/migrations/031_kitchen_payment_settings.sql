-- 031: configuracao de modo de pagamento das refeicoes por base

ALTER TABLE kitchen_meal_settings
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'manual'
    CHECK (payment_mode IN ('manual','proof','gateway')),
  ADD COLUMN IF NOT EXISTS payment_instructions text,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_provider_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
