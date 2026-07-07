-- ============================================================
-- SISGO — Migration 085: API pública para sites institucionais
-- ============================================================
--
-- Achado ao implementar: organizations/schools/school_classes têm RLS
-- ativado mas nenhuma policy de leitura anônima — só existe policy
-- pública em school_media (is_public da escola). Isso significa que a
-- página pública /{slug}/escola/{schoolSlug} hoje não retorna nenhuma
-- linha pra um visitante não autenticado (RLS nega por padrão sem
-- policy correspondente). Esta migration corrige isso e, com a mesma
-- regra, habilita a nova API pública em /api/public/[slug]/*.

-- ============================================================
-- 1. LEITURA PÚBLICA (anon) — organizations / schools / school_classes
-- ============================================================

-- Info básica da organização (nome, cidade, contato) é sempre pública
-- para orgs ativas — é o que qualquer site institucional precisa exibir.
create policy "organizations_public_read" on organizations
  for select using (active = true);

-- Espelha exatamente a regra já usada em school_media_public_read (003).
create policy "schools_public_read" on schools
  for select using (is_public = true and active = true);

create policy "school_classes_public_read" on school_classes
  for select using (
    exists (
      select 1 from schools s
      where s.id = school_id and s.is_public = true and s.active = true
    )
  );

-- ============================================================
-- 2. TOKEN PÚBLICO POR ORGANIZAÇÃO (site consumidor)
-- ============================================================
-- Não restringe dado (que já é público) — serve pra analytics por site,
-- allow-list de CORS por origem, e poder revogar o acesso de um site
-- específico sem afetar os demais.
create table if not exists organization_api_tokens (
  id                     uuid primary key default uuid_generate_v4(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  site_name              text not null,
  token                  text not null unique default encode(gen_random_bytes(24), 'hex'),
  allowed_origin         text,
  revalidate_webhook_url text,
  revalidate_secret      text,
  revoked_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table organization_api_tokens enable row level security;

create trigger trg_organization_api_tokens_updated_at
  before update on organization_api_tokens
  for each row execute function set_updated_at();

-- Gestão só por quem administra a organização (mesmo padrão de 006).
create policy "organization_api_tokens_admin_all" on organization_api_tokens
  for all using (
    is_superadmin() or (
      organization_id = auth_organization_id() and
      auth_role() in ('lider_base','admin_base')
    )
  );

-- Helper SECURITY DEFINER: valida um token sem expor a tabela de tokens
-- pra leitura anônima (mesmo padrão de auth_organization_id()/is_superadmin()).
-- Retorna organization_id + allowed_origin (pra CORS) num único jsonb.
create or replace function validate_public_api_token(p_token text)
returns jsonb language sql stable security definer as $$
  select jsonb_build_object('organization_id', organization_id, 'allowed_origin', allowed_origin)
  from organization_api_tokens
  where token = p_token and revoked_at is null
  limit 1;
$$;

-- ============================================================
-- 3. OVERRIDES DE ESTATÍSTICA (números históricos pré-sistema)
-- ============================================================
-- Ex.: "treinados desde 1986" não tem registro correspondente no banco.
create table if not exists organization_stats_overrides (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  key             text not null,
  label           text not null,
  value           text not null,
  updated_by      uuid references auth.users(id),
  updated_at      timestamptz not null default now(),
  unique (organization_id, key)
);

alter table organization_stats_overrides enable row level security;

create policy "organization_stats_overrides_admin_all" on organization_stats_overrides
  for all using (
    is_superadmin() or (
      organization_id = auth_organization_id() and
      auth_role() in ('lider_base','admin_base','dh')
    )
  );

-- Leitura pública (é exatamente o número que aparece no site).
create policy "organization_stats_overrides_public_read" on organization_stats_overrides
  for select using (true);

-- ============================================================
-- 4. "MISSIONÁRIOS ENVIADOS" — dado estruturado real
-- ============================================================
-- Capturado pelo DH no mesmo fluxo em que hoje já desliga um obreiro
-- (toggle "Desativar" em obreiros/ObreirosClientForms.tsx), como pergunta
-- opcional: foi enviado como missionário? Para onde?
alter table staff_profiles
  add column if not exists sent_as_missionary boolean not null default false,
  add column if not exists sent_to             text;

-- ============================================================
-- 5. ESTATÍSTICAS AGREGADAS — pra API pública /stats
-- ============================================================
create or replace function get_public_stats(p_org_id uuid)
returns jsonb language sql stable security definer as $$
  select jsonb_build_object(
    'turmas_realizadas', (
      select count(*) from school_classes sc
      join schools s on s.id = sc.school_id
      where s.organization_id = p_org_id
        and s.is_public = true
        and sc.ends_at is not null
        and sc.ends_at < now()
    ),
    'alunos_treinados', (
      select count(distinct cs.person_id) from class_students cs
      join school_classes sc on sc.id = cs.class_id
      join schools s on s.id = sc.school_id
      where s.organization_id = p_org_id
        and s.is_public = true
    ),
    'missionarios_enviados', (
      select count(*) from staff_profiles sp
      where sp.organization_id = p_org_id
        and sp.sent_as_missionary = true
    ),
    'overrides', (
      select coalesce(jsonb_object_agg(key, jsonb_build_object('label', label, 'value', value)), '{}'::jsonb)
      from organization_stats_overrides
      where organization_id = p_org_id
    )
  );
$$;
