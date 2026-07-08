-- 056: calendario da base

create table if not exists public.base_calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null default 'evento'
    check (event_type in ('evento','feriado','trimestre','escola','outro')),
  starts_on date not null,
  ends_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.base_calendar_events enable row level security;

create index if not exists idx_base_calendar_events_org_date
  on public.base_calendar_events(organization_id, starts_on);

drop trigger if exists trg_base_calendar_events_updated_at on public.base_calendar_events;
create trigger trg_base_calendar_events_updated_at
  before update on public.base_calendar_events
  for each row execute function set_updated_at();

create policy "base_calendar_events - org select" on public.base_calendar_events
  for select using (
    organization_id = auth_organization_id()
    or is_superadmin()
  );

create policy "base_calendar_events - dh manage" on public.base_calendar_events
  for all using (
    is_superadmin()
    or (organization_id = auth_organization_id() and auth_role() = 'dh')
  )
  with check (
    is_superadmin()
    or (organization_id = auth_organization_id() and auth_role() = 'dh')
  );
