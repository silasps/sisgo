-- 024: cozinha - consumidores de refeicoes e estoque

CREATE TABLE IF NOT EXISTS kitchen_meal_consumers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id       uuid REFERENCES people(id) ON DELETE SET NULL,
  consumer_name   text NOT NULL,
  meal_date       date NOT NULL,
  breakfast       boolean NOT NULL DEFAULT false,
  lunch           boolean NOT NULL DEFAULT false,
  dinner          boolean NOT NULL DEFAULT false,
  payment_type    text NOT NULL DEFAULT 'dia'
                  CHECK (payment_type IN ('dia','mes','refeicao','cortesia','outro')),
  paid_until      date,
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kitchen_meal_consumers_org_date_idx
  ON kitchen_meal_consumers (organization_id, meal_date);

CREATE TABLE IF NOT EXISTS kitchen_stock_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text,
  unit            text NOT NULL DEFAULT 'un',
  quantity        numeric(10,2) NOT NULL DEFAULT 0,
  min_quantity    numeric(10,2) NOT NULL DEFAULT 0,
  notes           text,
  active          boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kitchen_stock_items_org_active_idx
  ON kitchen_stock_items (organization_id, active, name);

ALTER TABLE kitchen_meal_consumers ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_stock_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kitchen_meal_consumers'
      AND policyname = 'kitchen meal consumers org read'
  ) THEN
    CREATE POLICY "kitchen meal consumers org read" ON kitchen_meal_consumers
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
      AND tablename = 'kitchen_meal_consumers'
      AND policyname = 'kitchen meal consumers secretaria manage'
  ) THEN
    CREATE POLICY "kitchen meal consumers secretaria manage" ON kitchen_meal_consumers
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kitchen_stock_items'
      AND policyname = 'kitchen stock org read'
  ) THEN
    CREATE POLICY "kitchen stock org read" ON kitchen_stock_items
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
      AND tablename = 'kitchen_stock_items'
      AND policyname = 'kitchen stock kitchen manage'
  ) THEN
    CREATE POLICY "kitchen stock kitchen manage" ON kitchen_stock_items
      FOR ALL
      USING (
        organization_id IN (
          SELECT ou.organization_id
          FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.active = true
            AND r.name IN ('superadmin','admin_base','lider_base','dh','secretaria','cozinha')
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT ou.organization_id
          FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.active = true
            AND r.name IN ('superadmin','admin_base','lider_base','dh','secretaria','cozinha')
        )
      );
  END IF;
END $$;
