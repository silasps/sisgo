-- ============================================================
-- SISGO - Schema inicial
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ORGANIZATIONS (bases/instituições missionárias)
-- ============================================================
create table organizations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  city        text,
  state       text,
  country     text not null default 'BR',
  phone       text,
  email       text,
  website     text,
  logo_url    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- ROLES
-- ============================================================
create table roles (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,   -- 'superadmin', 'admin_base', ...
  label       text not null,
  description text,
  created_at  timestamptz not null default now()
);

insert into roles (name, label, description) values
  ('superadmin', 'Super Administrador', 'Acesso total ao sistema'),
  ('admin_base', 'Administrador de Base', 'Acesso completo à sua organização');

-- ============================================================
-- ORGANIZATION_USERS (usuário <-> organização <-> papel)
-- ============================================================
create table organization_users (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade, -- null para superadmin
  role_id         uuid not null references roles(id),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, organization_id, role_id)
);

-- ============================================================
-- PEOPLE (tabela central de pessoas)
-- ============================================================
create table people (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name       text not null,
  preferred_name  text,
  birth_date      date,
  gender          text check (gender in ('M','F','outro')),
  nationality     text default 'BR',
  civil_status    text check (civil_status in ('solteiro','casado','divorciado','viuvo','outro')),
  photo_url       text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- PERSON_CONTACTS
-- ============================================================
create table person_contacts (
  id          uuid primary key default uuid_generate_v4(),
  person_id   uuid not null references people(id) on delete cascade,
  type        text not null check (type in ('email','phone','whatsapp','address','other')),
  value       text not null,
  label       text,        -- ex: "pessoal", "trabalho"
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PERSON_DOCUMENTS
-- ============================================================
create table person_documents (
  id          uuid primary key default uuid_generate_v4(),
  person_id   uuid not null references people(id) on delete cascade,
  type        text not null check (type in ('cpf','rg','passaporte','cnh','outro')),
  number      text not null,
  issued_by   text,
  issued_at   date,
  expires_at  date,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PERSON_STATUS_HISTORY
-- ============================================================
create table person_status_history (
  id          uuid primary key default uuid_generate_v4(),
  person_id   uuid not null references people(id) on delete cascade,
  status      text not null, -- 'visitante','candidato','obreiro','aluno','inativo',...
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  notes       text,
  created_by  uuid references auth.users(id)
);

-- ============================================================
-- STAFF (obreiros/staffs)
-- ============================================================
create table staff_applications (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  person_id       uuid not null references people(id) on delete cascade,
  status          text not null default 'pendente' check (status in ('pendente','em_analise','aprovado','reprovado','cancelado')),
  applied_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users(id),
  notes           text
);

create table staff_profiles (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  person_id       uuid not null unique references people(id) on delete cascade,
  role_title      text,        -- ex: "líder de louvor", "obreiro"
  area            text,
  joined_at       date,
  left_at         date,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- SCHOOLS (escolas missionárias)
-- ============================================================
create table schools (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  acronym         text,
  description     text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table school_classes (
  id          uuid primary key default uuid_generate_v4(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  year        int,
  semester    int,
  starts_at   date,
  ends_at     date,
  max_students int,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- STUDENTS (alunos)
-- ============================================================
create table student_applications (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  person_id       uuid not null references people(id) on delete cascade,
  school_id       uuid references schools(id),
  class_id        uuid references school_classes(id),
  status          text not null default 'pendente' check (status in ('pendente','em_analise','aprovado','reprovado','cancelado')),
  applied_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users(id),
  notes           text
);

create table student_profiles (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  person_id       uuid not null references people(id) on delete cascade,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table class_students (
  id          uuid primary key default uuid_generate_v4(),
  class_id    uuid not null references school_classes(id) on delete cascade,
  person_id   uuid not null references people(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  status      text not null default 'ativo' check (status in ('ativo','trancado','concluido','reprovado')),
  unique (class_id, person_id)
);

create table class_staff (
  id          uuid primary key default uuid_generate_v4(),
  class_id    uuid not null references school_classes(id) on delete cascade,
  person_id   uuid not null references people(id) on delete cascade,
  role        text not null default 'instrutor', -- 'instrutor','coordenador',...
  unique (class_id, person_id, role)
);

-- ============================================================
-- MINISTRIES
-- ============================================================
create table ministries (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table ministry_roles (
  id          uuid primary key default uuid_generate_v4(),
  ministry_id uuid not null references ministries(id) on delete cascade,
  name        text not null,  -- 'lider','membro','coordenador'
  unique (ministry_id, name)
);

create table ministry_members (
  id              uuid primary key default uuid_generate_v4(),
  ministry_id     uuid not null references ministries(id) on delete cascade,
  person_id       uuid not null references people(id) on delete cascade,
  ministry_role_id uuid references ministry_roles(id),
  joined_at       date,
  left_at         date,
  active          boolean not null default true,
  unique (ministry_id, person_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table notification_events (
  id          uuid primary key default uuid_generate_v4(),
  event_type  text not null,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create table notification_logs (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid references notification_events(id),
  user_id     uuid references auth.users(id),
  channel     text not null, -- 'email','push','in_app'
  status      text not null default 'pending',
  sent_at     timestamptz,
  error       text
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
create table audit_logs (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id),
  user_id         uuid references auth.users(id),
  action          text not null,
  table_name      text,
  record_id       uuid,
  old_data        jsonb,
  new_data        jsonb,
  ip_address      text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- UPDATED_AT trigger
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at before update on organizations
  for each row execute function set_updated_at();
create trigger trg_organization_users_updated_at before update on organization_users
  for each row execute function set_updated_at();
create trigger trg_people_updated_at before update on people
  for each row execute function set_updated_at();
create trigger trg_staff_profiles_updated_at before update on staff_profiles
  for each row execute function set_updated_at();
create trigger trg_student_profiles_updated_at before update on student_profiles
  for each row execute function set_updated_at();
create trigger trg_schools_updated_at before update on schools
  for each row execute function set_updated_at();
create trigger trg_school_classes_updated_at before update on school_classes
  for each row execute function set_updated_at();
create trigger trg_ministries_updated_at before update on ministries
  for each row execute function set_updated_at();
