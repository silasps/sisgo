-- ============================================================
-- SISGO — Migration 005: Corrige school_programs
--   1. Adiciona coluna image_url (faltante)
--   2. Corrige RLS para superadmin ter acesso irrestrito
-- ============================================================

-- 1. Coluna image_url que estava faltando na migration 004
alter table school_programs add column if not exists image_url text;

-- 2. Recria policy admin com suporte correto ao superadmin
drop policy if exists "school_programs_admin_all" on school_programs;

create policy "school_programs_admin_all" on school_programs
  for all using (
    is_superadmin()
    or exists (
      select 1 from organization_users ou
      join roles r on r.id = ou.role_id
      where ou.organization_id = school_programs.organization_id
        and ou.user_id = auth.uid()
        and ou.active = true
        and r.name = 'admin_base'
    )
  );
