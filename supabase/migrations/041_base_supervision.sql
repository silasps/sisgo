-- 041: supervisao hibrida de bases

INSERT INTO roles (name, label, description) VALUES
  ('supervisor_bases', 'Supervisor de Bases', 'Acessa e gerencia apenas as bases vinculadas diretamente ou por grupos')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS base_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  parent_group_id uuid REFERENCES base_groups(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS base_group_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES base_groups(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, organization_id)
);

CREATE TABLE IF NOT EXISTS base_group_leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES base_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS base_supervisors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS base_groups_parent_idx ON base_groups (parent_group_id, active);
CREATE INDEX IF NOT EXISTS base_group_orgs_org_idx ON base_group_organizations (organization_id);
CREATE INDEX IF NOT EXISTS base_group_leaders_user_idx ON base_group_leaders (user_id, active);
CREATE INDEX IF NOT EXISTS base_supervisors_user_idx ON base_supervisors (user_id, active);

DO $$
DECLARE
  target_table text;
BEGIN
  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION supervised_base_ids(target_user_id uuid)
    RETURNS TABLE (organization_id uuid)
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
      WITH RECURSIVE led_groups AS (
        SELECT bgl.group_id
        FROM base_group_leaders bgl
        WHERE bgl.user_id = target_user_id
          AND bgl.active = true
        UNION
        SELECT bg.id
        FROM base_groups bg
        JOIN led_groups lg ON bg.parent_group_id = lg.group_id
        WHERE bg.active = true
      )
      SELECT bs.organization_id
      FROM base_supervisors bs
      WHERE bs.user_id = target_user_id
        AND bs.active = true
      UNION
      SELECT bgo.organization_id
      FROM base_group_organizations bgo
      JOIN led_groups lg ON lg.group_id = bgo.group_id;
    $fn$;
  $sql$;

  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION user_supervises_organization(target_organization_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
      SELECT EXISTS (
        SELECT 1
        FROM supervised_base_ids(auth.uid()) s
        WHERE s.organization_id = target_organization_id
      );
    $fn$;
  $sql$;

  ALTER TABLE base_groups ENABLE ROW LEVEL SECURITY;
  ALTER TABLE base_group_organizations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE base_group_leaders ENABLE ROW LEVEL SECURITY;
  ALTER TABLE base_supervisors ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'base_groups' AND policyname = 'base groups superadmin all') THEN
    CREATE POLICY "base groups superadmin all" ON base_groups
      FOR ALL USING (is_superadmin()) WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'base_groups' AND policyname = 'base groups leader read') THEN
    CREATE POLICY "base groups leader read" ON base_groups
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM base_group_leaders bgl
          WHERE bgl.group_id = base_groups.id
            AND bgl.user_id = auth.uid()
            AND bgl.active = true
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'base_group_organizations' AND policyname = 'base group orgs superadmin all') THEN
    CREATE POLICY "base group orgs superadmin all" ON base_group_organizations
      FOR ALL USING (is_superadmin()) WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'base_group_leaders' AND policyname = 'base group leaders superadmin all') THEN
    CREATE POLICY "base group leaders superadmin all" ON base_group_leaders
      FOR ALL USING (is_superadmin()) WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'base_supervisors' AND policyname = 'base supervisors superadmin all') THEN
    CREATE POLICY "base supervisors superadmin all" ON base_supervisors
      FOR ALL USING (is_superadmin()) WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organizations' AND policyname = 'supervisors view assigned orgs') THEN
    CREATE POLICY "supervisors view assigned orgs" ON organizations
      FOR SELECT USING (user_supervises_organization(id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_users' AND policyname = 'supervisors view assigned org users') THEN
    CREATE POLICY "supervisors view assigned org users" ON organization_users
      FOR SELECT USING (user_supervises_organization(organization_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'people' AND policyname = 'supervisors manage assigned people') THEN
    CREATE POLICY "supervisors manage assigned people" ON people
      FOR ALL USING (user_supervises_organization(organization_id))
      WITH CHECK (user_supervises_organization(organization_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'person_contacts' AND policyname = 'supervisors manage assigned contacts') THEN
    CREATE POLICY "supervisors manage assigned contacts" ON person_contacts
      FOR ALL USING (
        EXISTS (SELECT 1 FROM people p WHERE p.id = person_id AND user_supervises_organization(p.organization_id))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM people p WHERE p.id = person_id AND user_supervises_organization(p.organization_id))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'person_documents' AND policyname = 'supervisors manage assigned documents') THEN
    CREATE POLICY "supervisors manage assigned documents" ON person_documents
      FOR ALL USING (
        EXISTS (SELECT 1 FROM people p WHERE p.id = person_id AND user_supervises_organization(p.organization_id))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM people p WHERE p.id = person_id AND user_supervises_organization(p.organization_id))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'person_status_history' AND policyname = 'supervisors manage assigned status') THEN
    CREATE POLICY "supervisors manage assigned status" ON person_status_history
      FOR ALL USING (
        EXISTS (SELECT 1 FROM people p WHERE p.id = person_id AND user_supervises_organization(p.organization_id))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM people p WHERE p.id = person_id AND user_supervises_organization(p.organization_id))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schools' AND policyname = 'supervisors manage assigned schools') THEN
    CREATE POLICY "supervisors manage assigned schools" ON schools
      FOR ALL USING (user_supervises_organization(organization_id))
      WITH CHECK (user_supervises_organization(organization_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'school_classes' AND policyname = 'supervisors manage assigned classes') THEN
    CREATE POLICY "supervisors manage assigned classes" ON school_classes
      FOR ALL USING (
        EXISTS (SELECT 1 FROM schools s WHERE s.id = school_id AND user_supervises_organization(s.organization_id))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM schools s WHERE s.id = school_id AND user_supervises_organization(s.organization_id))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ministries' AND policyname = 'supervisors manage assigned ministries') THEN
    CREATE POLICY "supervisors manage assigned ministries" ON ministries
      FOR ALL USING (user_supervises_organization(organization_id))
      WITH CHECK (user_supervises_organization(organization_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ministry_roles' AND policyname = 'supervisors manage assigned ministry roles') THEN
    CREATE POLICY "supervisors manage assigned ministry roles" ON ministry_roles
      FOR ALL USING (
        EXISTS (SELECT 1 FROM ministries m WHERE m.id = ministry_id AND user_supervises_organization(m.organization_id))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM ministries m WHERE m.id = ministry_id AND user_supervises_organization(m.organization_id))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ministry_members' AND policyname = 'supervisors manage assigned ministry members') THEN
    CREATE POLICY "supervisors manage assigned ministry members" ON ministry_members
      FOR ALL USING (
        EXISTS (SELECT 1 FROM ministries m WHERE m.id = ministry_id AND user_supervises_organization(m.organization_id))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM ministries m WHERE m.id = ministry_id AND user_supervises_organization(m.organization_id))
      );
  END IF;

  FOR target_table IN
    SELECT unnest(ARRAY[
      'staff_applications',
      'staff_profiles',
      'student_applications',
      'student_profiles',
      'school_interest_forms',
      'school_applications',
      'reservations',
      'service_requests',
      'financial_transactions',
      'finance_funds',
      'finance_categories',
      'finance_budgets',
      'finance_expense_requests',
      'finance_cash_scopes',
      'kitchen_meal_consumers',
      'kitchen_stock_items',
      'kitchen_stock_lots',
      'kitchen_stock_movements',
      'kitchen_meal_settings',
      'kitchen_meal_payment_charges',
      'kitchen_meal_payment_reviews'
    ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = target_table
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = target_table AND column_name = 'organization_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
        AND policyname = 'supervisors manage assigned org rows'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "supervisors manage assigned org rows" ON %I FOR ALL USING (user_supervises_organization(organization_id)) WITH CHECK (user_supervises_organization(organization_id))',
        target_table
      );
    END IF;
  END LOOP;
END $$;
