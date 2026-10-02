-- 161: líder da escola/ministério concede (ou não) a um obreiro específico
-- a visibilidade da hospedagem do professor visitante daquela escola — por
-- padrão ninguém além de líder/DH vê (can_view default false).

create table if not exists school_teacher_lodging_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  school_id       uuid not null references schools(id) on delete cascade,
  person_id       uuid not null references people(id) on delete cascade,
  can_view boolean not null default false,
  set_by uuid references auth.users(id),
  set_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, person_id)
);

create index if not exists school_teacher_lodging_access_school_idx
  on school_teacher_lodging_access (school_id);

alter table school_teacher_lodging_access enable row level security;

create policy "school_teacher_lodging_access - org read" on school_teacher_lodging_access
  for select using (is_superadmin() or organization_id = auth_organization_id());

create policy "school_teacher_lodging_access - org write" on school_teacher_lodging_access
  for all using (is_superadmin() or organization_id = auth_organization_id())
  with check (is_superadmin() or organization_id = auth_organization_id());
