-- 042: fornecedores do estoque da cozinha

CREATE TABLE IF NOT EXISTS kitchen_stock_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  contact_phone text,
  contact_email text,
  address text,
  cnpj text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kitchen_stock_suppliers_org_idx
  ON kitchen_stock_suppliers (organization_id, active, name);

ALTER TABLE kitchen_stock_suppliers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kitchen_stock_suppliers'
      AND policyname = 'kitchen suppliers org roles manage'
  ) THEN
    CREATE POLICY "kitchen suppliers org roles manage" ON kitchen_stock_suppliers
      FOR ALL USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1
          FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = kitchen_stock_suppliers.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base', 'lider_base', 'secretaria', 'cozinha'])
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
            AND ou.organization_id = kitchen_stock_suppliers.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base', 'lider_base', 'secretaria', 'cozinha'])
        )
        OR user_supervises_organization(organization_id)
      );
  END IF;
END $$;
