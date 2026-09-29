-- ============================================================
-- SISGO — Migration 157: Tarefas só pra quem tem vínculo com a unidade
-- ============================================================
--
-- O quadro de Tarefas é de cada ministério/escola em si: só quem é líder ou
-- membro/obreiro DAQUELA unidade vê e mexe — sem exceção pra gestão da base
-- (quem da gestão lidera ou participa da unidade tem o vínculo normalmente).
-- A aplicação já aplica isso (layouts, páginas e actions de tarefas); aqui a
-- RLS (camada extra de defesa, migrations 141/156) passa a dizer o mesmo:
-- sai o is_base_management() das policies do quadro.

drop policy if exists "ministry_board_columns - select" on public.ministry_board_columns;
create policy "ministry_board_columns - select" on public.ministry_board_columns
  for select using (
    organization_id = auth_organization_id()
    and public.is_linked_to_board_unit(ministry_id, school_id)
  );

drop policy if exists "ministry_board_columns - manage" on public.ministry_board_columns;
create policy "ministry_board_columns - manage" on public.ministry_board_columns
  for all using (
    organization_id = auth_organization_id()
    and public.is_board_unit_leader(ministry_id, school_id)
  )
  with check (
    organization_id = auth_organization_id()
    and public.is_board_unit_leader(ministry_id, school_id)
  );

drop policy if exists "ministry_board_cards - select" on public.ministry_board_cards;
create policy "ministry_board_cards - select" on public.ministry_board_cards
  for select using (
    organization_id = auth_organization_id()
    and public.is_linked_to_board_unit(ministry_id, school_id)
  );

drop policy if exists "ministry_board_cards - insert" on public.ministry_board_cards;
create policy "ministry_board_cards - insert" on public.ministry_board_cards
  for insert with check (
    organization_id = auth_organization_id()
    and public.is_linked_to_board_unit(ministry_id, school_id)
  );

drop policy if exists "ministry_board_cards - update" on public.ministry_board_cards;
create policy "ministry_board_cards - update" on public.ministry_board_cards
  for update using (
    organization_id = auth_organization_id()
    and public.is_linked_to_board_unit(ministry_id, school_id)
  )
  with check (
    organization_id = auth_organization_id()
    and public.is_linked_to_board_unit(ministry_id, school_id)
  );

drop policy if exists "ministry_board_cards - delete" on public.ministry_board_cards;
create policy "ministry_board_cards - delete" on public.ministry_board_cards
  for delete using (
    organization_id = auth_organization_id()
    and public.is_linked_to_board_unit(ministry_id, school_id)
    and (public.is_board_unit_leader(ministry_id, school_id) or created_by = auth.uid())
  );
