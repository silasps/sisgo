-- 141: quadro de tarefas (kanban) genérico por ministério — colunas e cards,
-- sem tabela de "board" separada (mesmo espírito de ministry_messages: o
-- quadro é implícito ao ministry_id, não um recurso à parte que precisa ser
-- criado). Primeiro ministério a divulgar é Comunicação, mas o recurso vale
-- pra qualquer ministério da organização.

create table public.ministry_board_columns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  name text not null,
  position int not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ministry_board_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Denormalizado de column_id — a consistência é responsabilidade da
  -- server action (sempre grava ministry_id = column.ministry_id, nunca
  -- confia em input do cliente), mesmo estilo de enforcement em nível de
  -- aplicação já usado no resto do schema.
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  column_id uuid not null references public.ministry_board_columns(id) on delete cascade,
  title text not null,
  description text,
  position int not null,
  priority text not null default 'media' check (priority in ('baixa','media','alta')),
  assignee_person_id uuid references public.people(id) on delete set null,
  due_date date,
  labels text[],
  announcement_id uuid references public.base_announcements(id) on delete set null,
  created_by uuid not null references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ministry_board_columns_ministry on public.ministry_board_columns(ministry_id, position);
create index idx_ministry_board_cards_column on public.ministry_board_cards(column_id, position);
create index idx_ministry_board_cards_ministry on public.ministry_board_cards(ministry_id);

drop trigger if exists trg_ministry_board_columns_updated_at on public.ministry_board_columns;
create trigger trg_ministry_board_columns_updated_at
  before update on public.ministry_board_columns
  for each row execute function set_updated_at();

drop trigger if exists trg_ministry_board_cards_updated_at on public.ministry_board_cards;
create trigger trg_ministry_board_cards_updated_at
  before update on public.ministry_board_cards
  for each row execute function set_updated_at();

alter table public.ministry_board_columns enable row level security;
alter table public.ministry_board_cards enable row level security;

-- ── Helpers de vínculo ──────────────────────────────────────────────────
-- Vínculo (líder OU membro ativo) com o ministério — nunca por auth_role(),
-- porque um papel principal qualquer (ex. hospitalidade) pode ser membro de
-- qualquer ministério (ver lib/auth/unit-access.ts). Diferente de
-- ministry_messages (migration 080), que é propositalmente frouxa (SELECT
-- org-wide): aqui os cards carregam dado operacional (responsável, prazo)
-- que justifica RLS de verdade, não só controle na aplicação.
create or replace function is_linked_to_ministry(target_ministry_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.ministry_leaders ml
    where ml.ministry_id = target_ministry_id and ml.user_id = auth.uid()
  ) or exists (
    select 1 from public.ministry_members mm
    join public.staff_profiles sp on sp.person_id = mm.person_id and sp.user_id = auth.uid()
    where mm.ministry_id = target_ministry_id and mm.active = true
  );
$$;

create or replace function is_ministry_leader(target_ministry_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.ministry_leaders ml
    where ml.ministry_id = target_ministry_id and ml.user_id = auth.uid()
  );
$$;

create or replace function is_base_management()
returns boolean language sql stable security definer as $$
  select is_superadmin() or auth_role() in ('admin_base','lider_base','dh');
$$;

-- ── ministry_board_columns ──────────────────────────────────────────────
-- SELECT: gestão da base, ou vínculo (líder/membro) com o ministério.
create policy "ministry_board_columns - select" on public.ministry_board_columns
  for select using (
    organization_id = auth_organization_id()
    and (is_base_management() or is_linked_to_ministry(ministry_id))
  );

-- INSERT/UPDATE/DELETE: só líder do ministério ou gestão — membro não
-- configura colunas (só opera os cards no dia a dia).
create policy "ministry_board_columns - manage" on public.ministry_board_columns
  for all using (
    organization_id = auth_organization_id()
    and (is_base_management() or is_ministry_leader(ministry_id))
  )
  with check (
    organization_id = auth_organization_id()
    and (is_base_management() or is_ministry_leader(ministry_id))
  );

-- ── ministry_board_cards ────────────────────────────────────────────────
-- SELECT: gestão da base, ou vínculo (líder/membro) com o ministério.
create policy "ministry_board_cards - select" on public.ministry_board_cards
  for select using (
    organization_id = auth_organization_id()
    and (is_base_management() or is_linked_to_ministry(ministry_id))
  );

-- INSERT/UPDATE: líder ou membro operam o quadro no dia a dia.
create policy "ministry_board_cards - insert" on public.ministry_board_cards
  for insert with check (
    organization_id = auth_organization_id()
    and (is_base_management() or is_linked_to_ministry(ministry_id))
  );

create policy "ministry_board_cards - update" on public.ministry_board_cards
  for update using (
    organization_id = auth_organization_id()
    and (is_base_management() or is_linked_to_ministry(ministry_id))
  )
  with check (
    organization_id = auth_organization_id()
    and (is_base_management() or is_linked_to_ministry(ministry_id))
  );

-- DELETE: autor do card, líder do ministério, ou gestão — membro comum não
-- apaga card de outra pessoa.
create policy "ministry_board_cards - delete" on public.ministry_board_cards
  for delete using (
    organization_id = auth_organization_id()
    and (is_base_management() or is_ministry_leader(ministry_id) or created_by = auth.uid())
  );
