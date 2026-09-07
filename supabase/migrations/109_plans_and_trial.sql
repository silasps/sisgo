-- 109: planos comerciais (pricing) + vínculo de organização a plano/trial
--
-- Modelo híbrido: cada plano define um conjunto de módulos habilitados +
-- uma faixa de pessoas (alunos + obreiros/equipe) incluída, com cobrança
-- adicional por faixa extra. Enforcement de módulo por plano fica fora de
-- escopo desta migration (ver FLUXO/plano de melhoria da área pública).

create table if not exists public.plans (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text not null unique,
  name                      text not null,
  modules                   jsonb not null default '[]',
  max_people                int,                    -- null = ilimitado
  price_cents               int not null,
  extra_people_step         int,
  extra_people_price_cents  int,
  is_active                 boolean not null default true,
  sort_order                int not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.plans enable row level security;

drop trigger if exists trg_plans_updated_at on public.plans;
create trigger trg_plans_updated_at
  before update on public.plans
  for each row execute function set_updated_at();

create policy "plans_public_read" on public.plans
  for select using (is_active = true);

create policy "plans_superadmin_all" on public.plans
  for all using (is_superadmin());

-- Vínculo da organização a um plano + controle de trial/tipo
alter table public.organizations
  add column if not exists plan_id       uuid references public.plans(id),
  add column if not exists trial_ends_at timestamptz,
  add column if not exists org_type      text check (org_type in ('jocum', 'missao', 'outro'));

-- Seed inicial dos 3 tiers — preços e faixas placeholder, ajustar antes de publicar
insert into public.plans (slug, name, modules, max_people, price_cents, extra_people_step, extra_people_price_cents, sort_order)
values
  ('essencial', 'Essencial',
   '["pessoas","comunicacao","calendario"]'::jsonb,
   20, 9900, 10, 2900, 1),
  ('escolas', 'Escolas',
   '["pessoas","comunicacao","calendario","escolas","financeiro"]'::jsonb,
   30, 24900, 10, 2900, 2),
  ('completo', 'Completo',
   '["pessoas","comunicacao","calendario","escolas","financeiro","hospedagem","cozinha","ministerios","carteirinha","lavanderia"]'::jsonb,
   null, 49900, 10, 2900, 3)
on conflict (slug) do nothing;
