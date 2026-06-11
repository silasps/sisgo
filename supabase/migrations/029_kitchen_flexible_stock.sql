-- 029: estoque flexivel para cozinha/base missionaria

ALTER TABLE kitchen_stock_items
  ADD COLUMN IF NOT EXISTS default_location text,
  ADD COLUMN IF NOT EXISTS critical boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS kitchen_stock_lots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id          uuid NOT NULL REFERENCES kitchen_stock_items(id) ON DELETE CASCADE,
  source_type      text NOT NULL DEFAULT 'compra'
                   CHECK (source_type IN ('compra','doacao','outro')),
  supplier_name    text,
  lot_code         text,
  expiration_date  date,
  quantity_initial numeric(10,2) NOT NULL DEFAULT 0,
  quantity_current numeric(10,2) NOT NULL DEFAULT 0,
  unit_cost        numeric(10,2),
  received_at      date NOT NULL DEFAULT CURRENT_DATE,
  location         text,
  notes            text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kitchen_stock_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id         uuid NOT NULL REFERENCES kitchen_stock_items(id) ON DELETE CASCADE,
  lot_id          uuid REFERENCES kitchen_stock_lots(id) ON DELETE SET NULL,
  movement_type   text NOT NULL
                  CHECK (movement_type IN ('entrada','saida','perda','ajuste','transferencia','doacao_saida')),
  quantity        numeric(10,2) NOT NULL DEFAULT 0,
  unit_cost       numeric(10,2),
  source_type     text,
  location_from   text,
  location_to     text,
  reason          text,
  notes           text,
  movement_date   date NOT NULL DEFAULT CURRENT_DATE,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kitchen_stock_lots_org_item_exp_idx
  ON kitchen_stock_lots (organization_id, item_id, expiration_date);

CREATE INDEX IF NOT EXISTS kitchen_stock_movements_org_date_idx
  ON kitchen_stock_movements (organization_id, movement_date DESC);

ALTER TABLE kitchen_stock_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_stock_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kitchen_stock_lots'
      AND policyname = 'kitchen stock lots org read'
  ) THEN
    CREATE POLICY "kitchen stock lots org read" ON kitchen_stock_lots
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
      AND tablename = 'kitchen_stock_lots'
      AND policyname = 'kitchen stock lots kitchen manage'
  ) THEN
    CREATE POLICY "kitchen stock lots kitchen manage" ON kitchen_stock_lots
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kitchen_stock_movements'
      AND policyname = 'kitchen stock movements org read'
  ) THEN
    CREATE POLICY "kitchen stock movements org read" ON kitchen_stock_movements
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
      AND tablename = 'kitchen_stock_movements'
      AND policyname = 'kitchen stock movements kitchen manage'
  ) THEN
    CREATE POLICY "kitchen stock movements kitchen manage" ON kitchen_stock_movements
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
