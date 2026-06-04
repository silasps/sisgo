-- ============================================================
-- SISGO — Migration 003: Páginas públicas de escolas + inscrições
-- ============================================================

-- ============================================================
-- ESTENDER tabela schools
-- ============================================================
alter table schools
  add column if not exists slug              text unique,
  add column if not exists school_type       text not null default 'eted'
             check (school_type in ('eted','udn','seminario','curso_online','voluntariado','outro')),
  add column if not exists subtitle          text,
  add column if not exists long_description  text,
  add column if not exists objectives        text[],
  add column if not exists target_audience   text,
  add column if not exists duration_description text,
  add column if not exists hero_image_url    text,
  add column if not exists hero_video_url    text,
  add column if not exists promo_video_url   text,
  add column if not exists prerequisites     text[],
  add column if not exists is_public         boolean not null default false;

-- ============================================================
-- ESTENDER tabela school_classes
-- ============================================================
alter table school_classes
  add column if not exists registrations_open    boolean not null default false,
  add column if not exists registration_deadline timestamptz,
  add column if not exists base_cost             numeric(10,2),
  add column if not exists cost_description      text,
  add column if not exists location              text,
  add column if not exists public_description    text,
  add column if not exists online_applications   boolean not null default false;

-- ============================================================
-- NOVA tabela school_media
-- ============================================================
create table if not exists school_media (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references schools(id) on delete cascade,
  type        text not null check (type in ('image','video_url')),
  url         text not null,
  caption     text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table school_media enable row level security;

-- ============================================================
-- NOVA tabela school_interest_forms (pré-inscrição pública)
-- ============================================================
create table if not exists school_interest_forms (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  school_id       uuid not null references schools(id) on delete cascade,
  class_id        uuid references school_classes(id) on delete set null,
  full_name       text not null,
  email           text not null,
  phone           text,
  message         text,
  status          text not null default 'pendente'
                  check (status in ('pendente','formulario_enviado','em_contato','convertido','descartado')),
  notified_at     timestamptz,
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table school_interest_forms enable row level security;

create trigger trg_school_interest_forms_updated_at
  before update on school_interest_forms
  for each row execute function set_updated_at();

-- ============================================================
-- NOVA tabela school_applications (formulário completo)
-- ============================================================
create table if not exists school_applications (
  id               uuid primary key default uuid_generate_v4(),
  interest_form_id uuid references school_interest_forms(id) on delete set null,
  organization_id  uuid not null references organizations(id) on delete cascade,
  school_id        uuid not null references schools(id) on delete cascade,
  class_id         uuid references school_classes(id) on delete set null,
  token            text not null unique default encode(gen_random_bytes(32), 'hex'),
  token_expires_at timestamptz not null default (now() + interval '30 days'),
  status           text not null default 'rascunho'
                   check (status in ('rascunho','enviado','em_analise','aprovado','reprovado','cancelado')),
  current_section  int not null default 1,
  form_data        jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table school_applications enable row level security;

create trigger trg_school_applications_updated_at
  before update on school_applications
  for each row execute function set_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- school_media: leitura pública para escolas is_public=true; gerência por admin da org
create policy "school_media_public_read" on school_media
  for select using (
    exists (
      select 1 from schools s
      where s.id = school_id and s.is_public = true
    )
  );

create policy "school_media_admin_all" on school_media
  for all using (
    exists (
      select 1 from schools s
      join organization_users ou on ou.organization_id = s.organization_id
      join roles r on r.id = ou.role_id
      where s.id = school_id
        and ou.user_id = auth.uid()
        and ou.active = true
        and r.name in ('admin_base','superadmin')
    )
  );

-- school_interest_forms: INSERT público; leitura/edição por admin da org
create policy "school_interest_forms_public_insert" on school_interest_forms
  for insert with check (true);

create policy "school_interest_forms_admin_select" on school_interest_forms
  for select using (
    exists (
      select 1 from organization_users ou
      join roles r on r.id = ou.role_id
      where ou.organization_id = organization_id
        and ou.user_id = auth.uid()
        and ou.active = true
        and r.name in ('admin_base','superadmin')
    )
  );

create policy "school_interest_forms_admin_update" on school_interest_forms
  for update using (
    exists (
      select 1 from organization_users ou
      join roles r on r.id = ou.role_id
      where ou.organization_id = organization_id
        and ou.user_id = auth.uid()
        and ou.active = true
        and r.name in ('admin_base','superadmin')
    )
  );

-- school_applications: acesso via token (sem auth); admin da org lê/atualiza
create policy "school_applications_token_select" on school_applications
  for select using (true); -- token validado na aplicação

create policy "school_applications_token_update" on school_applications
  for update using (true); -- token validado na aplicação

create policy "school_applications_admin_all" on school_applications
  for all using (
    exists (
      select 1 from organization_users ou
      join roles r on r.id = ou.role_id
      where ou.organization_id = organization_id
        and ou.user_id = auth.uid()
        and ou.active = true
        and r.name in ('admin_base','superadmin')
    )
  );

-- ============================================================
-- SUPABASE STORAGE — bucket school-media
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-media',
  'school-media',
  true,
  10485760, -- 10MB por arquivo
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

create policy "school_media_bucket_public_read" on storage.objects
  for select using (bucket_id = 'school-media');

create policy "school_media_bucket_admin_upload" on storage.objects
  for insert with check (
    bucket_id = 'school-media' and auth.uid() is not null
  );

create policy "school_media_bucket_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'school-media' and auth.uid() is not null
  );
