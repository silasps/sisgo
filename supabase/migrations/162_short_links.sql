-- 162: links curtos (/l/<code>) pra divulgar páginas públicas de pré-inscrição
-- (WhatsApp, Instagram, site) sem o caminho completo com slug da base/escola.

create table if not exists short_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  code text not null unique,
  target_url text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists short_links_org_target_idx on short_links (organization_id, target_url);

alter table short_links enable row level security;

-- Leitura/escrita só pra gestão da própria organização (criação de link);
-- o redirecionamento público em si roda com o client admin (service role),
-- que ignora RLS — não precisa de policy de leitura pública aqui.
create policy "short_links - org read" on short_links
  for select using (is_superadmin() or organization_id = auth_organization_id());

create policy "short_links - org insert" on short_links
  for insert with check (is_superadmin() or organization_id = auth_organization_id());
