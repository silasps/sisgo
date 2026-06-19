-- 068: melhorias em solicitações de serviço + transferências de obreiros entre ministérios

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE A — Solicitações de serviço: assigned_to, redirected_from, em_andamento
-- ═══════════════════════════════════════════════════════════════════════════════

-- A1. Campo assigned_to — quem assumiu a solicitação
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

-- A2. Campo redirected_from — histórico de redirecionamento (para "outro")
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS redirected_from text;

-- A3. Adicionar status 'em_andamento' ao CHECK de status
ALTER TABLE service_requests
  DROP CONSTRAINT IF EXISTS service_requests_status_check;

ALTER TABLE service_requests
  ADD CONSTRAINT service_requests_status_check
  CHECK (status IN ('pendente','em_analise','em_andamento','resolvido','rejeitado'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE B — Transferências de obreiros entre ministérios
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE ministry_transfers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id           uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  from_ministry_id    uuid NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  to_ministry_id      uuid NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
  requested_by        uuid NOT NULL REFERENCES auth.users(id),
  reason              text,
  status              text NOT NULL DEFAULT 'pendente_destino'
                      CHECK (status IN (
                        'pendente_destino',
                        'rejeitado_destino',
                        'aceito_destino',
                        'rejeitado_dh',
                        'efetivado',
                        'cancelado'
                      )),
  dest_reviewed_by    uuid REFERENCES auth.users(id),
  dest_reviewed_at    timestamptz,
  dest_notes          text,
  dh_reviewed_by      uuid REFERENCES auth.users(id),
  dh_reviewed_at      timestamptz,
  dh_notes            text,
  effective_date      date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ministry_transfers_org_status_idx
  ON ministry_transfers (organization_id, status);
CREATE INDEX ministry_transfers_person_idx
  ON ministry_transfers (person_id, status);
CREATE INDEX ministry_transfers_from_idx
  ON ministry_transfers (from_ministry_id, status);
CREATE INDEX ministry_transfers_to_idx
  ON ministry_transfers (to_ministry_id, status);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE ministry_transfers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ministry_transfers'
      AND policyname = 'ministry_transfers manage'
  ) THEN
    CREATE POLICY "ministry_transfers manage" ON ministry_transfers
      FOR ALL USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = ministry_transfers.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh'])
        )
        OR user_supervises_organization(organization_id)
        OR requested_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ministry_leaders ml
          WHERE ml.user_id = auth.uid()
            AND (ml.ministry_id = ministry_transfers.from_ministry_id
              OR ml.ministry_id = ministry_transfers.to_ministry_id)
        )
      )
      WITH CHECK (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = ministry_transfers.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh'])
        )
        OR user_supervises_organization(organization_id)
        OR requested_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM ministry_leaders ml
          WHERE ml.user_id = auth.uid()
            AND (ml.ministry_id = ministry_transfers.from_ministry_id
              OR ml.ministry_id = ministry_transfers.to_ministry_id)
        )
      );
  END IF;
END $$;
