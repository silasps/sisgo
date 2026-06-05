-- ============================================================
-- SISGO — Migration 004: Programas extras de escolas + escalamento
-- ============================================================

-- Programas extras configuráveis por org (Cordas, Perspectivas, Niko, etc.)
create table if not exists school_programs (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  additional_cost numeric(10,2),
  icon            text,
  sort_order      int not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table school_programs enable row level security;

create policy "school_programs_public_read" on school_programs
  for select using (active = true);

create policy "school_programs_admin_all" on school_programs
  for all using (
    exists (
      select 1 from organization_users ou
      join roles r on r.id = ou.role_id
      where ou.organization_id = organization_id
        and ou.user_id = auth.uid()
        and ou.active = true
        and r.name in ('admin_base','superadmin')
    )
  );

-- Quais programas cada turma inclui
create table if not exists school_class_programs (
  class_id   uuid not null references school_classes(id) on delete cascade,
  program_id uuid not null references school_programs(id) on delete cascade,
  primary key (class_id, program_id)
);

alter table school_class_programs enable row level security;

create policy "school_class_programs_public_read" on school_class_programs
  for select using (true);

create policy "school_class_programs_admin_all" on school_class_programs
  for all using (
    exists (
      select 1 from school_classes sc
      join schools s on s.id = sc.school_id
      join organization_users ou on ou.organization_id = s.organization_id
      join roles r on r.id = ou.role_id
      where sc.id = class_id
        and ou.user_id = auth.uid()
        and ou.active = true
        and r.name in ('admin_base','superadmin')
    )
  );

-- Adicionar campos de escalamento nas pré-inscrições
alter table school_interest_forms
  add column if not exists assigned_to_user_id uuid references auth.users(id) on delete set null,
  add column if not exists escalated_at timestamptz;
