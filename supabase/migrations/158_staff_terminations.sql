-- Desligamento formal de obreiro/voluntário — padrão SISGO (não específico
-- de organização). Ver src/lib/staff/terminationPolicy.ts pra prazo de
-- retenção e justificativa LGPD (pendente de revisão jurídica).

create table staff_terminations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  person_id           uuid not null references people(id) on delete cascade,
  staff_profile_id    uuid references staff_profiles(id) on delete set null,
  terminated_by       uuid references auth.users(id),
  reason_category     text not null check (reason_category in (
    'mudanca_cidade', 'motivos_pessoais_familiares', 'motivos_financeiros',
    'conflito_interpessoal', 'questao_disciplinar', 'fim_do_compromisso', 'saude', 'outro'
  )),
  reason_text         text,
  had_prior_conversation boolean not null default false,
  last_unit_label     text,
  leader_name         text,
  retained_until      date not null,
  data_status         text not null default 'retained' check (data_status in ('retained', 'anonymized')),
  created_at          timestamptz not null default now()
);

create index idx_staff_terminations_person on staff_terminations(person_id);
create index idx_staff_terminations_org on staff_terminations(organization_id);

alter table staff_terminations enable row level security;

create policy "staff_terminations - org read" on staff_terminations
  for select using (is_superadmin() or organization_id = auth_organization_id());

create policy "staff_terminations - management insert" on staff_terminations
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() in ('superadmin', 'admin_base', 'lider_base', 'dh')
  );
