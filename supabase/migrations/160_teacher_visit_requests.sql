-- 160: solicitação de entrada de professor visitante na base — líder/DH/
-- obreiro de escola pede a vinda de um professor pra dar aula num período;
-- se for se hospedar na base, a hospitalidade responde disponibilidade
-- (sem bloquear: a resposta é só informativa, o líder autoriza mesmo sem
-- vaga, porque a passagem da pessoa pela base precisa ser registrada).

create table if not exists teacher_visit_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  school_id       uuid not null references schools(id) on delete cascade,
  requested_by    uuid not null references auth.users(id),

  full_name     text not null,
  email         text not null,
  phone         text not null,
  phone_country text,

  -- Preenchido na autorização (resolvePerson/criação de people) — não na
  -- criação do pedido, pra não duplicar cadastro antes de confirmar a vinda.
  person_id uuid references people(id) on delete set null,

  teach_start_date date not null,
  teach_end_date   date not null,
  arrival_at    timestamptz not null,
  departure_at  timestamptz not null,

  needs_lodging boolean not null default false,

  -- null = não se aplica (não vai se hospedar, ou a base não tem
  -- hospitalidade); 'aguardando' só existe enquanto há hospitalidade E
  -- needs_lodging.
  hospedagem_status text check (hospedagem_status in ('aguardando', 'disponivel', 'sem_disponibilidade')),
  hospedagem_notes text,
  hospedagem_responded_by uuid references auth.users(id),
  hospedagem_responded_at timestamptz,

  status text not null default 'pendente' check (status in ('pendente', 'autorizado', 'cancelado')),
  authorized_by uuid references auth.users(id),
  authorized_at timestamptz,
  cancelled_by  uuid references auth.users(id),
  cancelled_at  timestamptz,
  cancel_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_visit_requests_org_status_idx
  on teacher_visit_requests (organization_id, status);
create index if not exists teacher_visit_requests_school_idx
  on teacher_visit_requests (school_id);
create index if not exists teacher_visit_requests_hospedagem_idx
  on teacher_visit_requests (organization_id, hospedagem_status);

alter table teacher_visit_requests enable row level security;

create policy "teacher_visit_requests - org read" on teacher_visit_requests
  for select using (is_superadmin() or organization_id = auth_organization_id());

create policy "teacher_visit_requests - org insert" on teacher_visit_requests
  for insert with check (is_superadmin() or organization_id = auth_organization_id());

create policy "teacher_visit_requests - org update" on teacher_visit_requests
  for update using (is_superadmin() or organization_id = auth_organization_id());
