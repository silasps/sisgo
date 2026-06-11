-- 032: multiplos metodos de pagamento ativos para refeicoes

ALTER TABLE kitchen_meal_settings
  ADD COLUMN IF NOT EXISTS payment_methods jsonb NOT NULL DEFAULT '["manual"]'::jsonb;
