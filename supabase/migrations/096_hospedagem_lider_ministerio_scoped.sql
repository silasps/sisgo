-- ============================================================
-- SISGO — Migration 096: hospitalidade escopada para líder de ministério
-- ============================================================
--
-- Depois que o DH aprova um obreiro, quem faz o handoff de hospitalidade
-- (onde a pessoa vai ficar, data de chegada) é o líder do ministério dela.
-- Hoje rooms/beds/room_allocations só liberam admin_base/lider_base/dh/
-- hospitalidade (067_hospedagem.sql). Aqui damos ao líder de ministério
-- leitura de rooms/beds (para escolher onde alocar) e escrita em
-- room_allocations, mas só para pessoas do seu próprio ministério.

-- rooms: leitura para líder de ministério (escopo por organização)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'rooms read lider_ministerio'
  ) THEN
    CREATE POLICY "rooms read lider_ministerio" ON rooms
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = rooms.organization_id
            AND ou.active = true
            AND r.name = 'lider_ministerio'
        )
      );
  END IF;
END $$;

-- beds: leitura para líder de ministério (escopo por organização)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beds' AND policyname = 'beds read lider_ministerio'
  ) THEN
    CREATE POLICY "beds read lider_ministerio" ON beds
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM organization_users ou
          JOIN roles r ON r.id = ou.role_id
          WHERE ou.user_id = auth.uid()
            AND ou.organization_id = beds.organization_id
            AND ou.active = true
            AND r.name = 'lider_ministerio'
        )
      );
  END IF;
END $$;

-- room_allocations: líder de ministério lê/cria só para pessoas do seu ministério
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'room_allocations' AND policyname = 'room_allocations scoped lider_ministerio'
  ) THEN
    CREATE POLICY "room_allocations scoped lider_ministerio" ON room_allocations
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM ministry_leaders ml
          JOIN ministry_members mm ON mm.ministry_id = ml.ministry_id
          WHERE ml.user_id = auth.uid()
            AND mm.person_id = room_allocations.person_id
            AND mm.active = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM ministry_leaders ml
          JOIN ministry_members mm ON mm.ministry_id = ml.ministry_id
          WHERE ml.user_id = auth.uid()
            AND mm.person_id = room_allocations.person_id
            AND mm.active = true
        )
      );
  END IF;
END $$;
