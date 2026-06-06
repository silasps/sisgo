-- ============================================================
-- SISGO — Migration 012: Gestão de Ministérios + Solicitações
-- ============================================================

-- Novo papel
insert into roles (name, label, description) values
  ('lider_ministerio', 'Líder de Ministério',
   'Gerencia seu próprio ministério e solicita alterações ao DH')
on conflict (name) do nothing;

-- ──────────────────────────────────────────────────────────────
-- ministry_leaders: vínculo usuário → ministério como líder
-- ──────────────────────────────────────────────────────────────
create table ministry_leaders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  ministry_id     uuid not null references ministries(id)    on delete cascade,
  user_id         uuid not null references auth.users(id)    on delete cascade,
  created_at      timestamptz not null default now(),
  unique (ministry_id, user_id)
);

alter table ministry_leaders enable row level security;

create policy "ministry_leaders - org read" on ministry_leaders
  for select using (
    is_superadmin() or organization_id = auth_organization_id()
  );

create policy "ministry_leaders - management write" on ministry_leaders
  for all using (
    is_superadmin() or
    (organization_id = auth_organization_id()
     and auth_role() in ('admin_base','lider_base','dh'))
  );

-- ──────────────────────────────────────────────────────────────
-- ministry_pending_requests: solicitações do líder ao DH
-- ──────────────────────────────────────────────────────────────
create table ministry_pending_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id)  on delete cascade,
  ministry_id      uuid not null references ministries(id)     on delete cascade,
  requested_by     uuid not null references auth.users(id),
  request_type     text not null
                   check (request_type in ('add_member','remove_member','change_role')),
  person_id        uuid references people(id),
  ministry_role_id uuid references ministry_roles(id),
  notes            text,
  status           text not null default 'pendente'
                   check (status in ('pendente','aprovado','rejeitado','cancelado')),
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

alter table ministry_pending_requests enable row level security;

-- Leitura: gestão vê tudo; lider_ministerio vê apenas o seu ministério
create policy "ministry_pending_requests - read" on ministry_pending_requests
  for select using (
    is_superadmin()
    or (organization_id = auth_organization_id()
        and auth_role() in ('admin_base','lider_base','dh'))
    or (
      auth_role() = 'lider_ministerio'
      and organization_id = auth_organization_id()
      and exists (
        select 1 from ministry_leaders ml
        where ml.ministry_id = ministry_pending_requests.ministry_id
          and ml.user_id = auth.uid()
      )
    )
  );

-- Escrita: gestão e lider_ministerio para o próprio ministério
create policy "ministry_pending_requests - write" on ministry_pending_requests
  for all using (
    is_superadmin()
    or (organization_id = auth_organization_id()
        and auth_role() in ('admin_base','lider_base','dh'))
    or (
      auth_role() = 'lider_ministerio'
      and organization_id = auth_organization_id()
      and exists (
        select 1 from ministry_leaders ml
        where ml.ministry_id = ministry_pending_requests.ministry_id
          and ml.user_id = auth.uid()
      )
    )
  );

-- ──────────────────────────────────────────────────────────────
-- service_requests: solicitações genéricas entre áreas
-- ──────────────────────────────────────────────────────────────
create table service_requests (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  requester_id      uuid not null references auth.users(id),
  requester_role    text not null,
  target_department text not null
                    check (target_department in
                           ('hospitalidade','dh','secretaria','outro')),
  request_type      text not null,
  subject           text not null,
  description       text,
  status            text not null default 'pendente'
                    check (status in
                           ('pendente','em_analise','resolvido','rejeitado')),
  reviewed_by       uuid references auth.users(id),
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);

alter table service_requests enable row level security;

-- Leitura: gestão vê tudo; destino vê as suas; solicitante vê as próprias
create policy "service_requests - read" on service_requests
  for select using (
    is_superadmin()
    or (organization_id = auth_organization_id()
        and auth_role() in ('admin_base','lider_base','dh'))
    or (organization_id = auth_organization_id()
        and auth_role() = 'hospitalidade'
        and target_department = 'hospitalidade')
    or (organization_id = auth_organization_id()
        and requester_id = auth.uid())
  );

-- Escrita: gestão, destinos e líderes solicitantes
create policy "service_requests - write" on service_requests
  for all using (
    is_superadmin()
    or (organization_id = auth_organization_id()
        and auth_role() in ('admin_base','lider_base','dh'))
    or (organization_id = auth_organization_id()
        and auth_role() = 'hospitalidade'
        and target_department = 'hospitalidade')
    or (organization_id = auth_organization_id()
        and auth_role() in ('lider_eted','lider_ministerio')
        and requester_id = auth.uid())
  );
