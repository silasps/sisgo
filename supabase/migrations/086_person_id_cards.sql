-- ============================================================
-- SISGO — Migration 086: Carteirinha digital (ID card) por pessoa
-- ============================================================
--
-- Carteira institucional (não é carteira de meia-entrada — ver decisão
-- de produto registrada no plano da feature). Papel atual, foto e
-- validade são sempre derivados em tempo real de people/student_profiles/
-- staff_profiles — a única coisa que precisa de estado próprio é o token
-- público revogável usado no QR code.

-- ============================================================
-- 1. TOKEN PÚBLICO POR PESSOA (revogável)
-- ============================================================
create table if not exists person_public_tokens (
  id                uuid primary key default uuid_generate_v4(),
  person_id         uuid not null references people(id) on delete cascade,
  organization_id   uuid not null references organizations(id) on delete cascade,
  token             text not null unique default encode(gen_random_bytes(24), 'hex'),
  revoked_at        timestamptz,
  access_count      integer not null default 0,
  last_accessed_at  timestamptz,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);

-- 1 token ativo por pessoa (histórico de tokens revogados é preservado).
create unique index if not exists person_public_tokens_active_person_idx
  on person_public_tokens (person_id) where revoked_at is null;

alter table person_public_tokens enable row level security;

create policy "person_public_tokens_admin_all" on person_public_tokens
  for all using (
    is_superadmin() or (
      organization_id = auth_organization_id() and
      auth_role() in ('lider_base', 'admin_base')
    )
  );

-- ============================================================
-- 2. FLAG POR ORGANIZAÇÃO (mesmo padrão de schools.public_page_enabled)
-- ============================================================
alter table organizations
  add column if not exists id_card_enabled boolean not null default false;

-- ============================================================
-- 3. RPC PÚBLICA — resolve o token sem expor people/profiles ao anon
-- ============================================================
-- Faz throttling simples (sem infra de rate limit no projeto): acima de
-- 30 acessos no último minuto pro mesmo token, retorna null (indisponível
-- temporariamente) em vez de continuar servindo.
create or replace function get_person_card_public(p_token text)
returns jsonb language plpgsql security definer as $$
declare
  v_token record;
  v_result jsonb;
begin
  select * into v_token
  from person_public_tokens
  where token = p_token and revoked_at is null;

  if v_token is null then
    return null;
  end if;

  if v_token.last_accessed_at is not null
     and v_token.last_accessed_at > now() - interval '1 minute'
     and v_token.access_count > 30 then
    return null;
  end if;

  update person_public_tokens
  set
    access_count = case
      when last_accessed_at is null or last_accessed_at < now() - interval '1 minute' then 1
      else access_count + 1
    end,
    last_accessed_at = now()
  where id = v_token.id;

  select jsonb_build_object(
    'person_id', p.id,
    'full_name', p.full_name,
    'photo_url', p.photo_url,
    'organization', jsonb_build_object(
      'name', o.name, 'logo_url', o.logo_url, 'accent_color', o.accent_color, 'slug', o.slug
    ),
    'is_student', exists(select 1 from student_profiles sp where sp.person_id = p.id and sp.active),
    'is_staff', exists(select 1 from staff_profiles st where st.person_id = p.id and st.active),
    'staff_role_title', (
      select role_title from staff_profiles st
      where st.person_id = p.id and st.active
      order by joined_at desc nulls last limit 1
    ),
    'active', exists(select 1 from student_profiles sp where sp.person_id = p.id and sp.active)
              or exists(select 1 from staff_profiles st where st.person_id = p.id and st.active)
  )
  into v_result
  from people p
  join organizations o on o.id = p.organization_id
  where p.id = v_token.person_id and o.active = true and o.id_card_enabled = true;

  return v_result;
end;
$$;

-- ============================================================
-- 4. RPC PÚBLICA — linha do tempo/história (só usada na página do QR)
-- ============================================================
create or replace function get_person_timeline(p_person_id uuid)
returns jsonb language sql stable security definer as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.started_at desc), '[]'::jsonb) from (
    select
      'status'::text as kind,
      initcap(status) as label,
      started_at::text as started_at,
      ended_at::text as ended_at,
      null::text as detail
    from person_status_history
    where person_id = p_person_id

    union all

    select
      'staff' as kind,
      coalesce(role_title, 'Obreiro') as label,
      joined_at::text as started_at,
      left_at::text as ended_at,
      area as detail
    from staff_profiles
    where person_id = p_person_id and joined_at is not null

    union all

    select
      'student' as kind,
      sc.name as label,
      cs.enrolled_at::text as started_at,
      null::text as ended_at,
      s.name as detail
    from class_students cs
    join school_classes sc on sc.id = cs.class_id
    join schools s on s.id = sc.school_id
    where cs.person_id = p_person_id
  ) t;
$$;

-- ============================================================
-- 5. BUCKET DE FOTOS DE PERFIL
-- ============================================================
-- Público (diferente de applicant-docs, que é privado): a foto aparece
-- na página pública de verificação do QR, sem login.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('person-photos', 'person-photos', true, 2097152, '{image/webp,image/jpeg,image/png}')
on conflict (id) do nothing;

create policy "person_photos_public_read" on storage.objects
  for select using (bucket_id = 'person-photos');

create policy "person_photos_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'person-photos');

create policy "person_photos_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'person-photos');
