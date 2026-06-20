-- 071: módulo de lavanderia self-service — máquinas, preços e sessões

-- ── 1. Máquinas de lavanderia ──────────────────────────────────────────────
CREATE TABLE laundry_machines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              text NOT NULL,
  type              text NOT NULL CHECK (type IN ('washer','dryer')),
  location          text,
  status            text NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available','in_use','maintenance','offline')),
  device_ip         text,
  device_auth       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX laundry_machines_org_status_idx ON laundry_machines (organization_id, status);

-- ── 2. Preços por tipo de máquina ──────────────────────────────────────────
CREATE TABLE laundry_pricing (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  machine_type      text NOT NULL CHECK (machine_type IN ('washer','dryer')),
  price_per_minute_cents int NOT NULL,
  min_minutes       int NOT NULL DEFAULT 15,
  max_minutes       int NOT NULL DEFAULT 180,
  step_minutes      int NOT NULL DEFAULT 15,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX laundry_pricing_org_idx ON laundry_pricing (organization_id, machine_type, active);

-- ── 3. Sessões de uso ──────────────────────────────────────────────────────
CREATE TABLE laundry_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  machine_id        uuid NOT NULL REFERENCES laundry_machines(id) ON DELETE CASCADE,
  person_id         uuid REFERENCES people(id) ON DELETE SET NULL,
  guest_name        text,
  pricing_id        uuid REFERENCES laundry_pricing(id) ON DELETE SET NULL,
  duration_minutes  int NOT NULL,
  amount_paid       int NOT NULL DEFAULT 0,
  payment_method    text NOT NULL
                    CHECK (payment_method IN ('pix','credit','debit','cash','balance','free')),
  payment_status    text NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','paid','failed','refunded')),
  payment_reference text,
  status            text NOT NULL DEFAULT 'pending_payment'
                    CHECK (status IN ('pending_payment','running','completed','cancelled')),
  started_at        timestamptz,
  expected_end_at   timestamptz,
  actual_end_at     timestamptz,
  notes             text,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX laundry_sessions_org_idx ON laundry_sessions (organization_id, status);
CREATE INDEX laundry_sessions_machine_idx ON laundry_sessions (machine_id, status);
CREATE INDEX laundry_sessions_created_idx ON laundry_sessions (organization_id, created_at DESC);

-- ── 4. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE laundry_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE laundry_pricing  ENABLE ROW LEVEL SECURITY;
ALTER TABLE laundry_sessions ENABLE ROW LEVEL SECURITY;

-- laundry_machines: management + hospitalidade
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laundry_machines' AND policyname = 'laundry_machines manage'
  ) THEN
    CREATE POLICY "laundry_machines manage" ON laundry_machines
      FOR ALL USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = laundry_machines.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        )
        OR user_supervises_organization(organization_id)
      )
      WITH CHECK (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = laundry_machines.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        )
        OR user_supervises_organization(organization_id)
      );
  END IF;
END $$;

-- laundry_pricing: management + hospitalidade
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laundry_pricing' AND policyname = 'laundry_pricing manage'
  ) THEN
    CREATE POLICY "laundry_pricing manage" ON laundry_pricing
      FOR ALL USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = laundry_pricing.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        )
        OR user_supervises_organization(organization_id)
      )
      WITH CHECK (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = laundry_pricing.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        )
        OR user_supervises_organization(organization_id)
      );
  END IF;
END $$;

-- laundry_sessions: management + hospitalidade
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laundry_sessions' AND policyname = 'laundry_sessions manage'
  ) THEN
    CREATE POLICY "laundry_sessions manage" ON laundry_sessions
      FOR ALL USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = laundry_sessions.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        )
        OR user_supervises_organization(organization_id)
      )
      WITH CHECK (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = laundry_sessions.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        )
        OR user_supervises_organization(organization_id)
      );
  END IF;
END $$;
