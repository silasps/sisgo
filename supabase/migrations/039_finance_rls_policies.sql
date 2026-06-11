-- 039: RLS financeiro e tabelas sensiveis relacionadas

DO $$
BEGIN
  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION finance_is_org_member(target_organization_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
      SELECT EXISTS (
        SELECT 1
        FROM organization_users ou
        JOIN roles r ON r.id = ou.role_id
        WHERE ou.user_id = auth.uid()
          AND ou.active = true
          AND (
            ou.organization_id = target_organization_id
            OR r.name = 'superadmin'
          )
      );
    $fn$;
  $sql$;

  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION finance_has_role(target_organization_id uuid, allowed_roles text[])
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
      SELECT EXISTS (
        SELECT 1
        FROM organization_users ou
        JOIN roles r ON r.id = ou.role_id
        WHERE ou.user_id = auth.uid()
          AND ou.active = true
          AND r.name = ANY (allowed_roles)
          AND (
            ou.organization_id = target_organization_id
            OR r.name = 'superadmin'
          )
      );
    $fn$;
  $sql$;

  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION finance_is_school_leader(target_organization_id uuid, target_school_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
      SELECT target_school_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM school_leaders sl
          WHERE sl.organization_id = target_organization_id
            AND sl.school_id = target_school_id
            AND sl.user_id = auth.uid()
        );
    $fn$;
  $sql$;

  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION finance_is_ministry_leader(target_organization_id uuid, target_ministry_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
      SELECT target_ministry_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM ministry_leaders ml
          WHERE ml.organization_id = target_organization_id
            AND ml.ministry_id = target_ministry_id
            AND ml.user_id = auth.uid()
        );
    $fn$;
  $sql$;

  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION finance_is_human_related(
      target_organization_id uuid,
      target_category_id uuid,
      target_text text,
      target_requester_id uuid DEFAULT NULL
    )
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
      SELECT
        EXISTS (
          SELECT 1
          FROM finance_categories fc
          WHERE fc.id = target_category_id
            AND fc.organization_id = target_organization_id
            AND (
              fc.name ILIKE '%obreiro%'
              OR fc.name ILIKE '%bolsa%'
              OR fc.name ILIKE '%apoio%'
              OR fc.name ILIKE '%mission%'
            )
        )
        OR COALESCE(target_text, '') ILIKE '%obreiro%'
        OR COALESCE(target_text, '') ILIKE '%bolsa%'
        OR COALESCE(target_text, '') ILIKE '%apoio%'
        OR COALESCE(target_text, '') ILIKE '%mission%'
        OR (
          target_requester_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM staff_profiles sp
            WHERE sp.organization_id = target_organization_id
              AND sp.user_id = target_requester_id
              AND sp.active = true
          )
        );
    $fn$;
  $sql$;

  ALTER TABLE finance_funds ENABLE ROW LEVEL SECURITY;
  ALTER TABLE finance_categories ENABLE ROW LEVEL SECURITY;
  ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE finance_expense_requests ENABLE ROW LEVEL SECURITY;
  ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE kitchen_meal_payment_reviews ENABLE ROW LEVEL SECURITY;
  ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_funds' AND policyname = 'finance funds org read') THEN
    CREATE POLICY "finance funds org read" ON finance_funds
      FOR SELECT USING (finance_is_org_member(organization_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_funds' AND policyname = 'finance funds full manage') THEN
    CREATE POLICY "finance funds full manage" ON finance_funds
      FOR ALL
      USING (finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria']))
      WITH CHECK (finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_categories' AND policyname = 'finance categories org read') THEN
    CREATE POLICY "finance categories org read" ON finance_categories
      FOR SELECT USING (finance_is_org_member(organization_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_categories' AND policyname = 'finance categories full manage') THEN
    CREATE POLICY "finance categories full manage" ON finance_categories
      FOR ALL
      USING (finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria']))
      WITH CHECK (finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_budgets' AND policyname = 'finance budgets scoped read') THEN
    CREATE POLICY "finance budgets scoped read" ON finance_budgets
      FOR SELECT USING (
        finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria'])
        OR (finance_has_role(organization_id, ARRAY['dh']) AND finance_is_human_related(organization_id, category_id, notes, NULL))
        OR finance_is_school_leader(organization_id, school_id)
        OR finance_is_ministry_leader(organization_id, ministry_id)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_budgets' AND policyname = 'finance budgets full manage') THEN
    CREATE POLICY "finance budgets full manage" ON finance_budgets
      FOR ALL
      USING (finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria']))
      WITH CHECK (finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_expense_requests' AND policyname = 'finance expense requests scoped read') THEN
    CREATE POLICY "finance expense requests scoped read" ON finance_expense_requests
      FOR SELECT USING (
        finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria'])
        OR (requester_id = auth.uid() AND finance_is_org_member(organization_id))
        OR (finance_has_role(organization_id, ARRAY['dh']) AND finance_is_human_related(organization_id, category_id, description, requester_id))
        OR finance_is_school_leader(organization_id, school_id)
        OR finance_is_ministry_leader(organization_id, ministry_id)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_expense_requests' AND policyname = 'finance expense requests org insert') THEN
    CREATE POLICY "finance expense requests org insert" ON finance_expense_requests
      FOR INSERT WITH CHECK (
        finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria'])
        OR (requester_id = auth.uid() AND finance_is_org_member(organization_id))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_expense_requests' AND policyname = 'finance expense requests review update') THEN
    CREATE POLICY "finance expense requests review update" ON finance_expense_requests
      FOR UPDATE
      USING (
        finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria'])
        OR (finance_has_role(organization_id, ARRAY['dh']) AND finance_is_human_related(organization_id, category_id, description, requester_id))
      )
      WITH CHECK (
        finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria'])
        OR (finance_has_role(organization_id, ARRAY['dh']) AND finance_is_human_related(organization_id, category_id, description, requester_id))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_expense_requests' AND policyname = 'finance expense requests full delete') THEN
    CREATE POLICY "finance expense requests full delete" ON finance_expense_requests
      FOR DELETE USING (finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'financial_transactions' AND policyname = 'financial transactions scoped read') THEN
    CREATE POLICY "financial transactions scoped read" ON financial_transactions
      FOR SELECT USING (
        finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria'])
        OR (created_by = auth.uid() AND finance_is_org_member(organization_id))
        OR (finance_has_role(organization_id, ARRAY['dh']) AND finance_is_human_related(organization_id, category_id, COALESCE(description, '') || ' ' || COALESCE(notes, ''), NULL))
        OR finance_is_school_leader(organization_id, school_id)
        OR finance_is_ministry_leader(organization_id, ministry_id)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'financial_transactions' AND policyname = 'financial transactions full manage') THEN
    CREATE POLICY "financial transactions full manage" ON financial_transactions
      FOR ALL
      USING (finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria']))
      WITH CHECK (finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kitchen_meal_payment_reviews' AND policyname = 'meal payment reviews finance read') THEN
    CREATE POLICY "meal payment reviews finance read" ON kitchen_meal_payment_reviews
      FOR SELECT USING (finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kitchen_meal_payment_reviews' AND policyname = 'meal payment reviews finance manage') THEN
    CREATE POLICY "meal payment reviews finance manage" ON kitchen_meal_payment_reviews
      FOR ALL
      USING (finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria']))
      WITH CHECK (finance_has_role(organization_id, ARRAY['superadmin','admin_base','lider_base','secretaria']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles' AND policyname = 'roles authenticated read') THEN
    CREATE POLICY "roles authenticated read" ON roles
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles' AND policyname = 'roles superadmin manage') THEN
    CREATE POLICY "roles superadmin manage" ON roles
      FOR ALL USING (is_superadmin()) WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_events' AND policyname = 'notification events own read') THEN
    CREATE POLICY "notification events own read" ON notification_events
      FOR SELECT USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM notification_logs nl
          WHERE nl.event_id = notification_events.id
            AND nl.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_logs' AND policyname = 'notification logs own read') THEN
    CREATE POLICY "notification logs own read" ON notification_logs
      FOR SELECT USING (is_superadmin() OR user_id = auth.uid());
  END IF;
END $$;
