-- 082: mural de mensagens por escola (stickers/post-its — espelha ministry_messages)

create table if not exists public.school_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  content text not null,
  mentions uuid[] default '{}',
  color smallint not null default 0,
  font smallint not null default 0,
  text_color smallint not null default 0,
  font_size smallint not null default 1,
  created_at timestamptz not null default now()
);

alter table public.school_messages enable row level security;

create index if not exists idx_school_messages_school
  on public.school_messages(school_id, created_at desc);

create policy "school_messages - org select" on public.school_messages
  for select using (
    organization_id = auth_organization_id()
    or is_superadmin()
  );

create policy "school_messages - members write" on public.school_messages
  for insert with check (
    is_superadmin()
    or (
      organization_id = auth_organization_id()
      and author_id = auth.uid()
    )
  );

create policy "school_messages - own delete" on public.school_messages
  for delete using (
    author_id = auth.uid()
    or is_superadmin()
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('admin_base','lider_base','dh')
    )
  );
