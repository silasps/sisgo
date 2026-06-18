-- 067: módulo de hospedagem — gestão de quartos, camas e alocações

-- ── 1. Quartos ──────────────────────────────────────────────────────────────
CREATE TABLE rooms (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              text NOT NULL,
  floor             text,
  type              text NOT NULL DEFAULT 'quarto'
                    CHECK (type IN ('quarto','suite','dormitorio','casal')),
  gender_constraint text DEFAULT NULL
                    CHECK (gender_constraint IS NULL OR gender_constraint IN ('masculino','feminino','misto')),
  capacity          int NOT NULL DEFAULT 1,
  status            text NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo','manutencao','inativo')),
  notes             text,
  display_order     int NOT NULL DEFAULT 0,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rooms_org_status_idx ON rooms (organization_id, status, display_order);

-- ── 2. Camas ────────────────────────────────────────────────────────────────
CREATE TABLE beds (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label             text NOT NULL,
  type              text NOT NULL DEFAULT 'solteiro'
                    CHECK (type IN ('solteiro','casal','beliche_sup','beliche_inf','colchao')),
  status            text NOT NULL DEFAULT 'disponivel'
                    CHECK (status IN ('disponivel','ocupada','manutencao','reservada')),
  position          int NOT NULL DEFAULT 0,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX beds_room_idx ON beds (room_id, position);
CREATE INDEX beds_org_status_idx ON beds (organization_id, status);

-- ── 3. Alocações ────────────────────────────────────────────────────────────
CREATE TABLE room_allocations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_id           uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_id            uuid REFERENCES beds(id) ON DELETE SET NULL,
  reservation_id    uuid REFERENCES reservations(id) ON DELETE SET NULL,
  person_id         uuid REFERENCES people(id) ON DELETE SET NULL,
  guest_name        text NOT NULL,
  guest_type        text NOT NULL DEFAULT 'visitante'
                    CHECK (guest_type IN ('aluno','obreiro','visitante','missionario','convidado')),
  check_in          date NOT NULL,
  check_out         date NOT NULL,
  actual_check_in   date,
  actual_check_out  date,
  status            text NOT NULL DEFAULT 'confirmada'
                    CHECK (status IN ('confirmada','checkin','checkout','cancelada')),
  notes             text,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX room_allocations_org_dates_idx ON room_allocations (organization_id, check_in, check_out);
CREATE INDEX room_allocations_room_idx ON room_allocations (room_id, check_in, check_out);
CREATE INDEX room_allocations_bed_idx ON room_allocations (bed_id, status);

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_allocations ENABLE ROW LEVEL SECURITY;

-- rooms: management + hospitalidade gerenciam
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'rooms manage'
  ) THEN
    CREATE POLICY "rooms manage" ON rooms
      FOR ALL USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = rooms.organization_id
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
            AND ou.organization_id = rooms.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        )
        OR user_supervises_organization(organization_id)
      );
  END IF;
END $$;

-- beds: management + hospitalidade gerenciam
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beds' AND policyname = 'beds manage'
  ) THEN
    CREATE POLICY "beds manage" ON beds
      FOR ALL USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = beds.organization_id
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
            AND ou.organization_id = beds.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        )
        OR user_supervises_organization(organization_id)
      );
  END IF;
END $$;

-- room_allocations: management + hospitalidade gerenciam
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'room_allocations' AND policyname = 'room_allocations manage'
  ) THEN
    CREATE POLICY "room_allocations manage" ON room_allocations
      FOR ALL USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = room_allocations.organization_id
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
            AND ou.organization_id = room_allocations.organization_id
            AND ou.active = true
            AND r.name = ANY (ARRAY['admin_base','lider_base','dh','hospitalidade'])
        )
        OR user_supervises_organization(organization_id)
      );
  END IF;
END $$;
