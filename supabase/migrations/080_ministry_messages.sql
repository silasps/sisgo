-- 080: mural de mensagens por ministério (stickers/post-its)

create table if not exists public.ministry_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  content text not null,
  mentions uuid[] default '{}',
  color smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.ministry_messages enable row level security;

create index if not exists idx_ministry_messages_ministry
  on public.ministry_messages(ministry_id, created_at desc);

create policy "ministry_messages - org select" on public.ministry_messages
  for select using (
    organization_id = auth_organization_id()
    or is_superadmin()
  );

create policy "ministry_messages - members write" on public.ministry_messages
  for insert with check (
    is_superadmin()
    or (
      organization_id = auth_organization_id()
      and author_id = auth.uid()
    )
  );

create policy "ministry_messages - own delete" on public.ministry_messages
  for delete using (
    author_id = auth.uid()
    or is_superadmin()
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('admin_base','lider_base','dh')
    )
  );
