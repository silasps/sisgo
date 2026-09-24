-- 137: delegação pontual de "quem pode criar escola"
--
-- Criar escola continua liberado pra quem já tem papel de gestão
-- (superadmin, admin_base, lider_base, dh — isManagementRole) — essa tabela
-- só ADICIONA pessoas específicas além desse grupo, escolhidas pelo líder
-- da base (mesmo padrão de "config sensível só líder_base" já usado em
-- BRANDING_ROLES/CASH_SCOPE_ROLES/ACCUMULATION_ROLES). Evita que qualquer
-- obreiro/líder de ministério crie escola sem controle, mas permite abrir
-- exceção pontual sem precisar mudar o papel principal da pessoa.

create table school_creation_delegates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  granted_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table school_creation_delegates enable row level security;

create policy "school_creation_delegates manage" on school_creation_delegates
  for all using (
    is_superadmin()
    or exists (
      select 1 from organization_users ou
      join roles r on r.id = ou.role_id
      where ou.user_id = auth.uid()
        and ou.organization_id = school_creation_delegates.organization_id
        and ou.active = true
        and r.name = 'lider_base'
    )
    or user_id = auth.uid()
  )
  with check (
    is_superadmin()
    or exists (
      select 1 from organization_users ou
      join roles r on r.id = ou.role_id
      where ou.user_id = auth.uid()
        and ou.organization_id = school_creation_delegates.organization_id
        and ou.active = true
        and r.name = 'lider_base'
    )
  );
