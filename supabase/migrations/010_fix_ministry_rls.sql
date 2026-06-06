-- ============================================================
-- SISGO — Corrige RLS dos ministérios
--
-- Problema: as políticas originais de escrita nas tabelas
-- ministry_members, ministry_roles e ministries não restringem
-- por papel do usuário — qualquer membro da org consegue
-- escrever via API direta, mesmo sem acesso à UI.
--
-- Regra de hierarquia da base:
--   Escrita: superadmin, admin_base, lider_base, dh
--   Leitura: mesmos + quem já tinha acesso
-- ============================================================

-- ministries: remover política de escrita irrestrita
drop policy if exists "ministries - all" on ministries;

create policy "ministries - management write" on ministries
  for all using (
    is_superadmin() or
    (
      organization_id = auth_organization_id() and
      auth_role() in ('admin_base', 'lider_base', 'dh')
    )
  );

-- ministry_roles: remover política de escrita irrestrita
drop policy if exists "ministry_roles - all" on ministry_roles;

create policy "ministry_roles - management write" on ministry_roles
  for all using (
    is_superadmin() or
    (
      auth_role() in ('admin_base', 'lider_base', 'dh') and
      exists (
        select 1 from ministries m
        where m.id = ministry_id
          and m.organization_id = auth_organization_id()
      )
    )
  );

-- ministry_members: remover política de escrita irrestrita
drop policy if exists "ministry_members - all" on ministry_members;

create policy "ministry_members - management write" on ministry_members
  for all using (
    is_superadmin() or
    (
      auth_role() in ('admin_base', 'lider_base', 'dh') and
      exists (
        select 1 from ministries m
        where m.id = ministry_id
          and m.organization_id = auth_organization_id()
      )
    )
  );
