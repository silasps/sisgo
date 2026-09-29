-- ============================================================
-- SISGO — Migration 156: quadro de Tarefas também nas escolas
-- ============================================================
--
-- O quadro (migration 141) nasceu só pra ministério. Agora cada escola tem o
-- seu também: as mesmas tabelas passam a aceitar school_id, e cada linha é
-- de UM ministério OU de UMA escola. Os nomes ministry_board_* ficam (renomear
-- quebraria o que já está no ar) — leia como "quadro da unidade".
--
-- RLS segue a mesma ideia da 141, agora pra escola também: vê/opera quem tem
-- vínculo com a unidade (líder/membro do ministério; líder/obreiro da
-- escola), configura colunas só o líder ou a gestão. A aplicação continua
-- sendo a fonte da verdade (actions com checagem própria + service role);
-- isto é a camada extra de defesa.

alter table public.ministry_board_columns
  alter column ministry_id drop not null,
  add column if not exists school_id uuid references public.schools(id) on delete cascade;

alter table public.ministry_board_cards
  alter column ministry_id drop not null,
  add column if not exists school_id uuid references public.schools(id) on delete cascade;

alter table public.ministry_board_columns drop constraint if exists ministry_board_columns_unit_check;
alter table public.ministry_board_columns add constraint ministry_board_columns_unit_check
  check ((ministry_id is null) <> (school_id is null));

alter table public.ministry_board_cards drop constraint if exists ministry_board_cards_unit_check;
alter table public.ministry_board_cards add constraint ministry_board_cards_unit_check
  check ((ministry_id is null) <> (school_id is null));

create unique index if not exists idx_board_columns_unique_name_school
  on public.ministry_board_columns (school_id, lower(name)) where school_id is not null;
create index if not exists idx_board_columns_school
  on public.ministry_board_columns (school_id, position) where school_id is not null;
create index if not exists idx_board_cards_school
  on public.ministry_board_cards (school_id) where school_id is not null;

create or replace function public.is_linked_to_school(target_school_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.school_leaders sl
    where sl.school_id = target_school_id and sl.user_id = auth.uid()
  ) or exists (
    select 1 from public.school_staff ss
    join public.staff_profiles sp on sp.person_id = ss.person_id and sp.user_id = auth.uid()
    where ss.school_id = target_school_id and ss.active = true
  );
$$;

create or replace function public.is_school_leader(target_school_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.school_leaders sl
    where sl.school_id = target_school_id and sl.user_id = auth.uid()
  );
$$;

create or replace function public.is_linked_to_board_unit(p_ministry_id uuid, p_school_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_ministry_id is not null then public.is_linked_to_ministry(p_ministry_id)
    else public.is_linked_to_school(p_school_id)
  end;
$$;

create or replace function public.is_board_unit_leader(p_ministry_id uuid, p_school_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_ministry_id is not null then public.is_ministry_leader(p_ministry_id)
    else public.is_school_leader(p_school_id)
  end;
$$;

drop policy if exists "ministry_board_columns - select" on public.ministry_board_columns;
create policy "ministry_board_columns - select" on public.ministry_board_columns
  for select using (
    organization_id = auth_organization_id()
    and (is_base_management() or public.is_linked_to_board_unit(ministry_id, school_id))
  );

drop policy if exists "ministry_board_columns - manage" on public.ministry_board_columns;
create policy "ministry_board_columns - manage" on public.ministry_board_columns
  for all using (
    organization_id = auth_organization_id()
    and (is_base_management() or public.is_board_unit_leader(ministry_id, school_id))
  )
  with check (
    organization_id = auth_organization_id()
    and (is_base_management() or public.is_board_unit_leader(ministry_id, school_id))
  );

drop policy if exists "ministry_board_cards - select" on public.ministry_board_cards;
create policy "ministry_board_cards - select" on public.ministry_board_cards
  for select using (
    organization_id = auth_organization_id()
    and (is_base_management() or public.is_linked_to_board_unit(ministry_id, school_id))
  );

drop policy if exists "ministry_board_cards - insert" on public.ministry_board_cards;
create policy "ministry_board_cards - insert" on public.ministry_board_cards
  for insert with check (
    organization_id = auth_organization_id()
    and (is_base_management() or public.is_linked_to_board_unit(ministry_id, school_id))
  );

drop policy if exists "ministry_board_cards - update" on public.ministry_board_cards;
create policy "ministry_board_cards - update" on public.ministry_board_cards
  for update using (
    organization_id = auth_organization_id()
    and (is_base_management() or public.is_linked_to_board_unit(ministry_id, school_id))
  )
  with check (
    organization_id = auth_organization_id()
    and (is_base_management() or public.is_linked_to_board_unit(ministry_id, school_id))
  );

drop policy if exists "ministry_board_cards - delete" on public.ministry_board_cards;
create policy "ministry_board_cards - delete" on public.ministry_board_cards
  for delete using (
    organization_id = auth_organization_id()
    and (is_base_management() or public.is_board_unit_leader(ministry_id, school_id) or created_by = auth.uid())
  );
