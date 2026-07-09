-- 086: pagamento PIX na lavanderia — página pública paga e libera a máquina

-- ── 1. Configuração de recebimento por organização ─────────────────────────
CREATE TABLE IF NOT EXISTS laundry_payment_settings (
  organization_id  uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  provider         text NOT NULL DEFAULT 'asaas' CHECK (provider IN ('asaas')),
  environment      text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox','production')),
  access_token     text,
  default_customer_id text,
  webhook_token    text,
  pix_key          text,
  public_payments_enabled boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE laundry_payment_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laundry_payment_settings' AND policyname = 'laundry_payment_settings manage'
  ) THEN
    CREATE POLICY "laundry_payment_settings manage" ON laundry_payment_settings
      FOR ALL USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = laundry_payment_settings.organization_id
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
            AND ou.organization_id = laundry_payment_settings.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        )
        OR user_supervises_organization(organization_id)
      );
  END IF;
END $$;

-- ── 2. Dados da cobrança PIX na sessão ──────────────────────────────────────
ALTER TABLE laundry_sessions
  ADD COLUMN IF NOT EXISTS provider_charge_id text,
  ADD COLUMN IF NOT EXISTS pix_copy_paste     text,
  ADD COLUMN IF NOT EXISTS pix_qr_base64      text;

CREATE INDEX IF NOT EXISTS laundry_sessions_charge_idx
  ON laundry_sessions (provider_charge_id) WHERE provider_charge_id IS NOT NULL;
