-- 078: calendario por ministério (espelha school_calendar_events)

create table if not exists public.ministry_calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null default 'evento'
    check (event_type in ('reuniao','devocional','evento','outro')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ministry_calendar_events enable row level security;

create index if not exists idx_ministry_calendar_events_org_date
  on public.ministry_calendar_events(organization_id, starts_at);

create index if not exists idx_ministry_calendar_events_ministry_date
  on public.ministry_calendar_events(ministry_id, starts_at);

drop trigger if exists trg_ministry_calendar_events_updated_at on public.ministry_calendar_events;
create trigger trg_ministry_calendar_events_updated_at
  before update on public.ministry_calendar_events
  for each row execute function set_updated_at();

create policy "ministry_calendar_events - org select" on public.ministry_calendar_events
  for select using (
    organization_id = auth_organization_id()
    or is_superadmin()
  );

create policy "ministry_calendar_events - ministry leaders manage" on public.ministry_calendar_events
  for all using (
    is_superadmin()
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('admin_base','lider_base')
    )
    or (
      organization_id = auth_organization_id()
      and auth_role() = 'lider_ministerio'
      and exists (
        select 1
        from public.ministry_leaders ml
        where ml.organization_id = ministry_calendar_events.organization_id
          and ml.ministry_id = ministry_calendar_events.ministry_id
          and ml.user_id = auth.uid()
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
      and auth_role() = 'lider_ministerio'
      and exists (
        select 1
        from public.ministry_leaders ml
        where ml.organization_id = ministry_calendar_events.organization_id
          and ml.ministry_id = ministry_calendar_events.ministry_id
          and ml.user_id = auth.uid()
      )
    )
  );
