-- ============================================================
-- Habilita RLS em blocks/floors/space_holds — ficaram sem policy desde
-- que foram criadas (migrations 110-111) porque as migrations nunca
-- rodaram `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, diferente das
-- tabelas irmãs `rooms`/`beds`, que já tinham. Sem RLS, essas 3 tabelas
-- ficam legíveis/graváveis por qualquer requisição com a anon key,
-- ignorando toda checagem de papel feita na aplicação — Supabase
-- Security Advisor sinalizou como CRITICAL.
--
-- Mesmo padrão de policy já usado em `rooms`/`beds`: gestão da base
-- (admin_base/lider_base/dh/hospitalidade) + supervisor de bases têm
-- ALL; lider_ministerio só tem SELECT. Consultas do backend usam
-- createAdminClient() (service role), que ignora RLS — isso aqui é a
-- rede de segurança contra a anon key, não a autorização principal
-- (essa já é feita nas páginas, ver SYSTEM_ARCHITECTURE.md seção 4).
-- ============================================================

alter table blocks enable row level security;
alter table floors enable row level security;
alter table space_holds enable row level security;

create policy "blocks manage" on blocks for all using (
  is_superadmin()
  or exists (
    select 1 from organization_users ou join roles r on r.id = ou.role_id
    where ou.user_id = auth.uid() and ou.organization_id = blocks.organization_id
      and ou.active = true and r.name = any (array['admin_base','lider_base','dh','hospitalidade'])
  )
  or user_supervises_organization(organization_id)
) with check (
  is_superadmin()
  or exists (
    select 1 from organization_users ou join roles r on r.id = ou.role_id
    where ou.user_id = auth.uid() and ou.organization_id = blocks.organization_id
      and ou.active = true and r.name = any (array['admin_base','lider_base','dh','hospitalidade'])
  )
  or user_supervises_organization(organization_id)
);

create policy "blocks read lider_ministerio" on blocks for select using (
  exists (
    select 1 from organization_users ou join roles r on r.id = ou.role_id
    where ou.user_id = auth.uid() and ou.organization_id = blocks.organization_id
      and ou.active = true and r.name = 'lider_ministerio'
  )
);

create policy "floors manage" on floors for all using (
  is_superadmin()
  or exists (
    select 1 from organization_users ou join roles r on r.id = ou.role_id
    where ou.user_id = auth.uid() and ou.organization_id = floors.organization_id
      and ou.active = true and r.name = any (array['admin_base','lider_base','dh','hospitalidade'])
  )
  or user_supervises_organization(organization_id)
) with check (
  is_superadmin()
  or exists (
    select 1 from organization_users ou join roles r on r.id = ou.role_id
    where ou.user_id = auth.uid() and ou.organization_id = floors.organization_id
      and ou.active = true and r.name = any (array['admin_base','lider_base','dh','hospitalidade'])
  )
  or user_supervises_organization(organization_id)
);

create policy "floors read lider_ministerio" on floors for select using (
  exists (
    select 1 from organization_users ou join roles r on r.id = ou.role_id
    where ou.user_id = auth.uid() and ou.organization_id = floors.organization_id
      and ou.active = true and r.name = 'lider_ministerio'
  )
);

create policy "space_holds manage" on space_holds for all using (
  is_superadmin()
  or exists (
    select 1 from organization_users ou join roles r on r.id = ou.role_id
    where ou.user_id = auth.uid() and ou.organization_id = space_holds.organization_id
      and ou.active = true and r.name = any (array['admin_base','lider_base','dh','hospitalidade'])
  )
  or user_supervises_organization(organization_id)
) with check (
  is_superadmin()
  or exists (
    select 1 from organization_users ou join roles r on r.id = ou.role_id
    where ou.user_id = auth.uid() and ou.organization_id = space_holds.organization_id
      and ou.active = true and r.name = any (array['admin_base','lider_base','dh','hospitalidade'])
  )
  or user_supervises_organization(organization_id)
);

create policy "space_holds read lider_ministerio" on space_holds for select using (
  exists (
    select 1 from organization_users ou join roles r on r.id = ou.role_id
    where ou.user_id = auth.uid() and ou.organization_id = space_holds.organization_id
      and ou.active = true and r.name = 'lider_ministerio'
  )
);
