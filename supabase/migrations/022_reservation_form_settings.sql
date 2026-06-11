-- 022: configuracao do formulario de reservas por base

CREATE TABLE IF NOT EXISTS reservation_form_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  fields          jsonb        NOT NULL DEFAULT '{}'::jsonb,
  updated_by      uuid         REFERENCES auth.users(id),
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE reservation_form_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reservation_form_settings'
      AND policyname = 'org members can view reservation form settings'
  ) THEN
    CREATE POLICY "org members can view reservation form settings" ON reservation_form_settings
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
      AND tablename = 'reservation_form_settings'
      AND policyname = 'hospitality and management can manage reservation form settings'
  ) THEN
    CREATE POLICY "hospitality and management can manage reservation form settings" ON reservation_form_settings
      FOR ALL
      USING (
        organization_id IN (
          SELECT organization_id FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.active = true
            AND r.name IN ('superadmin','admin_base','lider_base','dh','hospitalidade')
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.active = true
            AND r.name IN ('superadmin','admin_base','lider_base','dh','hospitalidade')
        )
      );
  END IF;
END $$;
