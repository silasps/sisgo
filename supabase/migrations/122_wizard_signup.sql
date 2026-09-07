-- 110: campos de suporte ao wizard de auto-cadastro institucional (/cadastro)
--
-- A organização criada pelo wizard fica ativa imediatamente (sem aprovação
-- manual) — a verificação de e-mail abaixo é um soft-gate informativo, não
-- bloqueia o uso do sistema.

alter table public.organizations
  add column if not exists contact_email_verified          boolean not null default false,
  add column if not exists signup_verification_token       text unique,
  add column if not exists signup_verification_expires_at  timestamptz;

-- Cargo do responsável institucional que preencheu o wizard
alter table public.organization_users
  add column if not exists title text;

-- Rate limiting simples do wizard de cadastro (sem infra externa disponível hoje)
create table if not exists public.signup_attempts (
  id          uuid primary key default gen_random_uuid(),
  ip          text,
  email       text,
  created_at  timestamptz not null default now()
);

alter table public.signup_attempts enable row level security;

create index if not exists idx_signup_attempts_ip_created
  on public.signup_attempts(ip, created_at desc);

-- Sem policy de leitura/escrita para authenticated/anon — só a service role
-- (server action com createAdminClient()) grava e lê essa tabela.
