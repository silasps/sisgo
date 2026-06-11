-- 026: precos de refeicoes e totais de compra da cozinha

CREATE TABLE IF NOT EXISTS kitchen_meal_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  breakfast_price numeric(10,2) NOT NULL DEFAULT 0,
  lunch_price     numeric(10,2) NOT NULL DEFAULT 0,
  dinner_price    numeric(10,2) NOT NULL DEFAULT 0,
  combo_lunch_dinner_includes_breakfast boolean NOT NULL DEFAULT false,
  lunch_dinner_discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  updated_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kitchen_meal_consumers
  ADD COLUMN IF NOT EXISTS purchase_group_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE kitchen_meal_settings
  ADD COLUMN IF NOT EXISTS lunch_dinner_discount_percent numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE kitchen_meal_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kitchen_meal_settings'
      AND policyname = 'kitchen meal settings org read'
  ) THEN
    CREATE POLICY "kitchen meal settings org read" ON kitchen_meal_settings
      FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM organization_users
          WHERE user_id = auth.uid() AND active = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kitchen_meal_settings'
      AND policyname = 'kitchen meal settings secretaria manage'
  ) THEN
    CREATE POLICY "kitchen meal settings secretaria manage" ON kitchen_meal_settings
      FOR ALL
      USING (
        organization_id IN (
          SELECT ou.organization_id
          FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.active = true
            AND r.name IN ('superadmin','admin_base','lider_base','dh','secretaria')
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT ou.organization_id
          FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.active = true
            AND r.name IN ('superadmin','admin_base','lider_base','dh','secretaria')
        )
      );
  END IF;
END $$;
