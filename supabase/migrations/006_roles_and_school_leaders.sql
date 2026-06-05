-- ============================================================
-- SISGO — Novos roles e tabela de líderes de ETED
-- ============================================================

-- Novos roles da hierarquia da base
INSERT INTO roles (name, label, description) VALUES
  ('lider_base',    'Líder da Base',     'Acesso total à base, pode alterar função de qualquer pessoa'),
  ('dh',            'DH',                'Gestão de pessoas, vê tudo, não pode editar lider_base ou a si mesmo'),
  ('secretaria',    'Secretaria',        'Gestão financeira completa: boletos, pagamentos, custos'),
  ('cozinha',       'Cozinha',           'Visualiza lista de refeições do dia'),
  ('hospitalidade', 'Hospitalidade',     'Gestão de hóspedes, professores e valores de hospedagem'),
  ('lider_eted',    'Líder de ETED',     'Gestão da sua ETED: alunos, inscrições e turmas')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SCHOOL_LEADERS — vincula lider_eted à sua escola
-- ============================================================
create table if not exists school_leaders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  school_id       uuid not null references schools(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (school_id, user_id)
);

alter table school_leaders enable row level security;

-- Líder vê a si mesmo
create policy "school_leaders - self select" on school_leaders
  for select using (user_id = auth.uid());

-- Gestão pode ver todos da org
create policy "school_leaders - management select" on school_leaders
  for select using (
    is_superadmin() or organization_id = auth_organization_id()
  );

-- Apenas gestão pode inserir/alterar/deletar
create policy "school_leaders - management all" on school_leaders
  for all using (
    is_superadmin() or
    (organization_id = auth_organization_id() and auth_role() in ('admin_base','lider_base','dh'))
  );

-- ============================================================
-- Tornar novos roles com acesso equivalente ao admin_base no banco
-- (restrições finas aplicadas na camada de aplicação)
-- ============================================================

-- people
create policy "novos roles - people select" on people
  for select using (
    organization_id = auth_organization_id() and
    auth_role() in ('lider_base','dh','secretaria','cozinha','hospitalidade','lider_eted')
  );

create policy "novos roles - people write" on people
  for all using (
    organization_id = auth_organization_id() and
    auth_role() in ('lider_base','dh')
  );

-- person_contacts
create policy "novos roles - person_contacts select" on person_contacts
  for select using (
    auth_role() in ('lider_base','dh','secretaria','cozinha','hospitalidade','lider_eted') and
    exists (select 1 from people p where p.id = person_id and p.organization_id = auth_organization_id())
  );

-- person_status_history
create policy "novos roles - status_history select" on person_status_history
  for select using (
    auth_role() in ('lider_base','dh','secretaria','hospitalidade','lider_eted') and
    exists (select 1 from people p where p.id = person_id and p.organization_id = auth_organization_id())
  );

create policy "novos roles - status_history write" on person_status_history
  for all using (
    auth_role() in ('lider_base','dh') and
    exists (select 1 from people p where p.id = person_id and p.organization_id = auth_organization_id())
  );

-- staff_applications / staff_profiles
create policy "novos roles - staff_apps select" on staff_applications
  for select using (
    organization_id = auth_organization_id() and
    auth_role() in ('lider_base','dh','secretaria')
  );

create policy "novos roles - staff_profiles select" on staff_profiles
  for select using (
    organization_id = auth_organization_id() and
    auth_role() in ('lider_base','dh','secretaria','hospitalidade','lider_eted')
  );

-- student_applications / student_profiles
create policy "novos roles - student_apps select" on student_applications
  for select using (
    organization_id = auth_organization_id() and
    auth_role() in ('lider_base','dh','secretaria','lider_eted')
  );

create policy "novos roles - student_profiles select" on student_profiles
  for select using (
    organization_id = auth_organization_id() and
    auth_role() in ('lider_base','dh','secretaria','lider_eted')
  );

-- schools / school_classes
create policy "novos roles - schools select" on schools
  for select using (
    organization_id = auth_organization_id() and
    auth_role() in ('lider_base','dh','secretaria','hospitalidade','lider_eted')
  );

create policy "novos roles - school_classes select" on school_classes
  for select using (
    auth_role() in ('lider_base','dh','secretaria','hospitalidade','lider_eted') and
    exists (select 1 from schools s where s.id = school_id and s.organization_id = auth_organization_id())
  );

-- ministries
create policy "novos roles - ministries select" on ministries
  for select using (
    organization_id = auth_organization_id() and
    auth_role() in ('lider_base','dh')
  );

-- organization_users (lider_base e dh precisam gerenciar)
create policy "novos roles - org_users select" on organization_users
  for select using (
    organization_id = auth_organization_id() and
    auth_role() in ('lider_base','dh')
  );

create policy "novos roles - org_users write" on organization_users
  for all using (
    organization_id = auth_organization_id() and
    auth_role() in ('lider_base','dh')
  );

-- organizations
create policy "novos roles - organizations select" on organizations
  for select using (
    id = auth_organization_id() and
    auth_role() in ('lider_base','dh','secretaria','cozinha','hospitalidade','lider_eted')
  );
