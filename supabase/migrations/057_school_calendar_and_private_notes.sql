-- 057: calendarios por escola e anotacoes pessoais

create table if not exists public.school_calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null default 'aula'
    check (event_type in ('aula','tema','evento','outro')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.school_calendar_events enable row level security;

create index if not exists idx_school_calendar_events_org_date
  on public.school_calendar_events(organization_id, starts_at);

create index if not exists idx_school_calendar_events_school_date
  on public.school_calendar_events(school_id, starts_at);

drop trigger if exists trg_school_calendar_events_updated_at on public.school_calendar_events;
create trigger trg_school_calendar_events_updated_at
  before update on public.school_calendar_events
  for each row execute function set_updated_at();

create policy "school_calendar_events - org select" on public.school_calendar_events
  for select using (
    organization_id = auth_organization_id()
    or is_superadmin()
  );

create policy "school_calendar_events - school leaders manage" on public.school_calendar_events
  for all using (
    is_superadmin()
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('admin_base','lider_base')
    )
    or (
      organization_id = auth_organization_id()
      and auth_role() = 'lider_eted'
      and exists (
        select 1
        from public.school_leaders sl
        where sl.organization_id = school_calendar_events.organization_id
          and sl.school_id = school_calendar_events.school_id
          and sl.user_id = auth.uid()
      )
    )
  )
  with check (
    is_superadmin()
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('admin_base','lider_base')
    )
    or (
      organization_id = auth_organization_id()
      and auth_role() = 'lider_eted'
      and exists (
        select 1
        from public.school_leaders sl
        where sl.organization_id = school_calendar_events.organization_id
          and sl.school_id = school_calendar_events.school_id
          and sl.user_id = auth.uid()
      )
    )
  );

create table if not exists public.personal_calendar_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.personal_calendar_notes enable row level security;

create index if not exists idx_personal_calendar_notes_user_date
  on public.personal_calendar_notes(user_id, starts_at);

drop trigger if exists trg_personal_calendar_notes_updated_at on public.personal_calendar_notes;
create trigger trg_personal_calendar_notes_updated_at
  before update on public.personal_calendar_notes
  for each row execute function set_updated_at();

create policy "personal_calendar_notes - own select" on public.personal_calendar_notes
  for select using (
    user_id = auth.uid()
    and organization_id = auth_organization_id()
  );

create policy "personal_calendar_notes - own manage" on public.personal_calendar_notes
  for all using (
    user_id = auth.uid()
    and organization_id = auth_organization_id()
  )
  with check (
    user_id = auth.uid()
    and organization_id = auth_organization_id()
  );

drop policy if exists "base_calendar_events - dh manage" on public.base_calendar_events;

create policy "base_calendar_events - base leaders manage" on public.base_calendar_events
  for all using (
    is_superadmin()
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('admin_base','lider_base')
    )
  )
  with check (
    is_superadmin()
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('admin_base','lider_base')
    )
  );
