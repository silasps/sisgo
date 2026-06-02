-- ============================================================
-- SISGO - Row Level Security
-- ============================================================

-- Helper: retorna organization_id do usuário logado
create or replace function auth_organization_id()
returns uuid language sql stable security definer as $$
  select organization_id
  from organization_users
  where user_id = auth.uid() and active = true
  limit 1;
$$;

-- Helper: retorna o nome do papel do usuário logado
create or replace function auth_role()
returns text language sql stable security definer as $$
  select r.name
  from organization_users ou
  join roles r on r.id = ou.role_id
  where ou.user_id = auth.uid() and ou.active = true
  limit 1;
$$;

-- Helper: verifica se é superadmin
create or replace function is_superadmin()
returns boolean language sql stable security definer as $$
  select auth_role() = 'superadmin';
$$;

-- ============================================================
-- Ativar RLS em todas as tabelas
-- ============================================================
alter table organizations         enable row level security;
alter table organization_users    enable row level security;
alter table people                enable row level security;
alter table person_contacts       enable row level security;
alter table person_documents      enable row level security;
alter table person_status_history enable row level security;
alter table staff_applications    enable row level security;
alter table staff_profiles        enable row level security;
alter table student_applications  enable row level security;
alter table student_profiles      enable row level security;
alter table schools               enable row level security;
alter table school_classes        enable row level security;
alter table class_students        enable row level security;
alter table class_staff           enable row level security;
alter table ministries            enable row level security;
alter table ministry_roles        enable row level security;
alter table ministry_members      enable row level security;
alter table audit_logs            enable row level security;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create policy "superadmin vê todas orgs" on organizations
  for select using (is_superadmin());

create policy "admin_base vê sua org" on organizations
  for select using (id = auth_organization_id());

create policy "superadmin gerencia orgs" on organizations
  for all using (is_superadmin());

-- ============================================================
-- ORGANIZATION_USERS
-- ============================================================
create policy "superadmin vê tudo" on organization_users
  for select using (is_superadmin());

create policy "admin_base vê usuários da sua org" on organization_users
  for select using (organization_id = auth_organization_id());

create policy "superadmin gerencia" on organization_users
  for all using (is_superadmin());

-- ============================================================
-- PEOPLE
-- ============================================================
create policy "superadmin vê todas pessoas" on people
  for select using (is_superadmin());

create policy "admin_base vê pessoas da sua org" on people
  for select using (organization_id = auth_organization_id());

create policy "superadmin gerencia pessoas" on people
  for all using (is_superadmin());

create policy "admin_base gerencia pessoas da sua org" on people
  for all using (organization_id = auth_organization_id() and auth_role() = 'admin_base');

-- ============================================================
-- PERSON_CONTACTS / DOCUMENTS / STATUS_HISTORY
-- ============================================================
create policy "person_contacts - select" on person_contacts
  for select using (
    is_superadmin() or
    exists (select 1 from people p where p.id = person_id and p.organization_id = auth_organization_id())
  );

create policy "person_contacts - all" on person_contacts
  for all using (
    is_superadmin() or
    exists (select 1 from people p where p.id = person_id and p.organization_id = auth_organization_id())
  );

create policy "person_documents - select" on person_documents
  for select using (
    is_superadmin() or
    exists (select 1 from people p where p.id = person_id and p.organization_id = auth_organization_id())
  );

create policy "person_documents - all" on person_documents
  for all using (
    is_superadmin() or
    exists (select 1 from people p where p.id = person_id and p.organization_id = auth_organization_id())
  );

create policy "person_status_history - select" on person_status_history
  for select using (
    is_superadmin() or
    exists (select 1 from people p where p.id = person_id and p.organization_id = auth_organization_id())
  );

create policy "person_status_history - all" on person_status_history
  for all using (
    is_superadmin() or
    exists (select 1 from people p where p.id = person_id and p.organization_id = auth_organization_id())
  );

-- ============================================================
-- STAFF
-- ============================================================
create policy "staff_applications - select" on staff_applications
  for select using (is_superadmin() or organization_id = auth_organization_id());
create policy "staff_applications - all" on staff_applications
  for all using (is_superadmin() or organization_id = auth_organization_id());

create policy "staff_profiles - select" on staff_profiles
  for select using (is_superadmin() or organization_id = auth_organization_id());
create policy "staff_profiles - all" on staff_profiles
  for all using (is_superadmin() or organization_id = auth_organization_id());

-- ============================================================
-- STUDENTS
-- ============================================================
create policy "student_applications - select" on student_applications
  for select using (is_superadmin() or organization_id = auth_organization_id());
create policy "student_applications - all" on student_applications
  for all using (is_superadmin() or organization_id = auth_organization_id());

create policy "student_profiles - select" on student_profiles
  for select using (is_superadmin() or organization_id = auth_organization_id());
create policy "student_profiles - all" on student_profiles
  for all using (is_superadmin() or organization_id = auth_organization_id());

-- ============================================================
-- SCHOOLS
-- ============================================================
create policy "schools - select" on schools
  for select using (is_superadmin() or organization_id = auth_organization_id());
create policy "schools - all" on schools
  for all using (is_superadmin() or organization_id = auth_organization_id());

create policy "school_classes - select" on school_classes
  for select using (
    is_superadmin() or
    exists (select 1 from schools s where s.id = school_id and s.organization_id = auth_organization_id())
  );
create policy "school_classes - all" on school_classes
  for all using (
    is_superadmin() or
    exists (select 1 from schools s where s.id = school_id and s.organization_id = auth_organization_id())
  );

create policy "class_students - select" on class_students
  for select using (
    is_superadmin() or
    exists (
      select 1 from school_classes sc
      join schools s on s.id = sc.school_id
      where sc.id = class_id and s.organization_id = auth_organization_id()
    )
  );
create policy "class_students - all" on class_students
  for all using (
    is_superadmin() or
    exists (
      select 1 from school_classes sc
      join schools s on s.id = sc.school_id
      where sc.id = class_id and s.organization_id = auth_organization_id()
    )
  );

create policy "class_staff - select" on class_staff
  for select using (
    is_superadmin() or
    exists (
      select 1 from school_classes sc
      join schools s on s.id = sc.school_id
      where sc.id = class_id and s.organization_id = auth_organization_id()
    )
  );
create policy "class_staff - all" on class_staff
  for all using (
    is_superadmin() or
    exists (
      select 1 from school_classes sc
      join schools s on s.id = sc.school_id
      where sc.id = class_id and s.organization_id = auth_organization_id()
    )
  );

-- ============================================================
-- MINISTRIES
-- ============================================================
create policy "ministries - select" on ministries
  for select using (is_superadmin() or organization_id = auth_organization_id());
create policy "ministries - all" on ministries
  for all using (is_superadmin() or organization_id = auth_organization_id());

create policy "ministry_roles - select" on ministry_roles
  for select using (
    is_superadmin() or
    exists (select 1 from ministries m where m.id = ministry_id and m.organization_id = auth_organization_id())
  );
create policy "ministry_roles - all" on ministry_roles
  for all using (
    is_superadmin() or
    exists (select 1 from ministries m where m.id = ministry_id and m.organization_id = auth_organization_id())
  );

create policy "ministry_members - select" on ministry_members
  for select using (
    is_superadmin() or
    exists (select 1 from ministries m where m.id = ministry_id and m.organization_id = auth_organization_id())
  );
create policy "ministry_members - all" on ministry_members
  for all using (
    is_superadmin() or
    exists (select 1 from ministries m where m.id = ministry_id and m.organization_id = auth_organization_id())
  );

-- ============================================================
-- AUDIT LOGS
-- ============================================================
create policy "audit_logs - superadmin" on audit_logs
  for select using (is_superadmin());
create policy "audit_logs - admin_base" on audit_logs
  for select using (organization_id = auth_organization_id());
create policy "audit_logs - insert" on audit_logs
  for insert with check (true);
