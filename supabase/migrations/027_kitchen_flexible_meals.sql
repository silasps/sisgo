-- 027: refeicoes e combos configuraveis da cozinha

ALTER TABLE kitchen_meal_settings
  ADD COLUMN IF NOT EXISTS meal_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS combo_rules jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE kitchen_meal_consumers
  ADD COLUMN IF NOT EXISTS selected_meals jsonb NOT NULL DEFAULT '[]'::jsonb;
