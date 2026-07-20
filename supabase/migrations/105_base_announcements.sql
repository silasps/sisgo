-- 105: anúncios da base (Comunicação) — visíveis a todos, com audiência opcional por papel

create table if not exists public.base_announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  title text not null,
  body text not null,
  pinned boolean not null default false,
  visible_to_roles text[],
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.base_announcements enable row level security;

create index if not exists idx_base_announcements_org
  on public.base_announcements(organization_id, pinned desc, created_at desc);

drop trigger if exists trg_base_announcements_updated_at on public.base_announcements;
create trigger trg_base_announcements_updated_at
  before update on public.base_announcements
  for each row execute function set_updated_at();

create policy "base_announcements - org select" on public.base_announcements
  for select using (
    organization_id = auth_organization_id()
    or is_superadmin()
  );

create policy "base_announcements - lider_base and comunicacao manage" on public.base_announcements
  for all using (
    is_superadmin()
    or (
      organization_id = auth_organization_id()
      and auth_role() = 'lider_base'
    )
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('lider_ministerio', 'obreiro_ministerio')
      and exists (
        select 1
        from public.ministries m
        join public.ministry_leaders ml on ml.ministry_id = m.id and ml.user_id = auth.uid()
        where m.organization_id = base_announcements.organization_id
          and m.linked_role = 'comunicacao'
      )
    )
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('lider_ministerio', 'obreiro_ministerio')
      and exists (
        select 1
        from public.ministries m
        join public.ministry_members mm on mm.ministry_id = m.id and mm.active = true
        join public.staff_profiles sp on sp.person_id = mm.person_id and sp.user_id = auth.uid()
        where m.organization_id = base_announcements.organization_id
          and m.linked_role = 'comunicacao'
      )
    )
  )
  with check (
    is_superadmin()
    or (
      organization_id = auth_organization_id()
      and auth_role() = 'lider_base'
    )
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('lider_ministerio', 'obreiro_ministerio')
      and exists (
        select 1
        from public.ministries m
        join public.ministry_leaders ml on ml.ministry_id = m.id and ml.user_id = auth.uid()
        where m.organization_id = base_announcements.organization_id
          and m.linked_role = 'comunicacao'
      )
    )
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('lider_ministerio', 'obreiro_ministerio')
      and exists (
        select 1
        from public.ministries m
        join public.ministry_members mm on mm.ministry_id = m.id and mm.active = true
        join public.staff_profiles sp on sp.person_id = mm.person_id and sp.user_id = auth.uid()
        where m.organization_id = base_announcements.organization_id
          and m.linked_role = 'comunicacao'
      )
    )
  );
