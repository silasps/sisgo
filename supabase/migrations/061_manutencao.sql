-- 061: módulo de manutenção
-- role manutencao + solicitações de serviço abertas a todos + estoque próprio

-- ── 1. Role ──────────────────────────────────────────────────────────────────
INSERT INTO roles (name, label, description) VALUES
  ('manutencao', 'Manutenção', 'Gestão de manutenção e cuidados da base: reparos, instalações e estoque')
ON CONFLICT (name) DO NOTHING;

-- ── 2. department_assignments: adicionar manutencao ao default e orgs existentes ──
ALTER TABLE organizations ALTER COLUMN department_assignments
  SET DEFAULT '{"hospitalidade":"hospitalidade","secretaria":"secretaria","manutencao":"manutencao"}'::jsonb;

UPDATE organizations
  SET department_assignments = department_assignments || '{"manutencao":"manutencao"}'::jsonb
  WHERE NOT (department_assignments ? 'manutencao');

-- ── 3. service_requests: priority + location_notes ────────────────────────────
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal','urgente')),
  ADD COLUMN IF NOT EXISTS location_notes text;

-- ── 4. RLS service_requests: permitir que TODOS os membros criem suas próprias ──
-- Remove a policy de escrita antiga e recria com escopo mais amplo.
DROP POLICY IF EXISTS "service_requests - write" ON service_requests;

CREATE POLICY "service_requests - write" ON service_requests
  FOR ALL USING (
    is_superadmin()
    OR (organization_id = auth_organization_id()
        AND auth_role() IN ('admin_base','lider_base','dh'))
    OR (organization_id = auth_organization_id()
        AND auth_role() = 'hospitalidade'
        AND target_department = 'hospitalidade')
    OR (organization_id = auth_organization_id()
        AND auth_role() = 'manutencao'
        AND (target_department = 'manutencao' OR requester_id = auth.uid()))
    OR (organization_id = auth_organization_id()
        AND requester_id = auth.uid())
  )
  WITH CHECK (
    is_superadmin()
    OR (organization_id = auth_organization_id()
        AND auth_role() IN ('admin_base','lider_base','dh'))
    OR (organization_id = auth_organization_id()
        AND auth_role() = 'hospitalidade'
        AND target_department = 'hospitalidade')
    OR (organization_id = auth_organization_id()
        AND auth_role() = 'manutencao'
        AND (target_department = 'manutencao' OR requester_id = auth.uid()))
    OR (organization_id = auth_organization_id()
        AND requester_id = auth.uid())
  );

-- ── 5. RLS service_requests: manutencao lê solicitações direcionadas a ela ────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_requests'
      AND policyname = 'service_requests - manutencao read'
  ) THEN
    CREATE POLICY "service_requests - manutencao read" ON service_requests
      FOR SELECT USING (
        organization_id = auth_organization_id()
        AND auth_role() = 'manutencao'
        AND target_department = 'manutencao'
      );
  END IF;
END $$;

-- ── 6. Itens do estoque de manutenção ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_stock_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code            text,
  name            text NOT NULL,
  category        text,
  unit            text NOT NULL DEFAULT 'un',
  quantity        numeric(10,2) NOT NULL DEFAULT 0,
  min_quantity    numeric(10,2) NOT NULL DEFAULT 0,
  location        text,
  notes           text,
  active          boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_stock_items_org_active_idx
  ON maintenance_stock_items (organization_id, active, name);

-- ── 7. Movimentações do estoque de manutenção ────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_stock_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id         uuid NOT NULL REFERENCES maintenance_stock_items(id) ON DELETE CASCADE,
  movement_type   text NOT NULL CHECK (movement_type IN ('entrada','saida','ajuste')),
  quantity        numeric(10,2) NOT NULL,
  reason          text,
  notes           text,
  movement_date   date NOT NULL DEFAULT CURRENT_DATE,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_stock_movements_org_item_date_idx
  ON maintenance_stock_movements (organization_id, item_id, movement_date DESC);

-- ── 8. RLS estoque de manutenção ─────────────────────────────────────────────
ALTER TABLE maintenance_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_stock_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Itens: gestão + manutencao gerenciam; todos lêem dentro da org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'maintenance_stock_items'
      AND policyname = 'maintenance stock items manage'
  ) THEN
    CREATE POLICY "maintenance stock items manage" ON maintenance_stock_items
      FOR ALL USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1
          FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = maintenance_stock_items.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','manutencao'])
        )
        OR user_supervises_organization(organization_id)
      )
      WITH CHECK (
        is_superadmin()
        OR EXISTS (
          SELECT 1
          FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = maintenance_stock_items.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','manutencao'])
        )
        OR user_supervises_organization(organization_id)
      );
  END IF;

  -- Movimentações: gestão + manutencao
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'maintenance_stock_movements'
      AND policyname = 'maintenance stock movements manage'
  ) THEN
    CREATE POLICY "maintenance stock movements manage" ON maintenance_stock_movements
      FOR ALL USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1
          FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = maintenance_stock_movements.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','manutencao'])
        )
        OR user_supervises_organization(organization_id)
      )
      WITH CHECK (
        is_superadmin()
        OR EXISTS (
          SELECT 1
          FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = maintenance_stock_movements.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','manutencao'])
        )
        OR user_supervises_organization(organization_id)
      );
  END IF;
END $$;
