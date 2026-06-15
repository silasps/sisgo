-- 059: Acúmulo de funções por base
-- Permite ao líder configurar quais funções são exercidas pela mesma pessoa.
-- Ex: {"dh": ["secretaria"]} → quem é DH nesta base também acumula Secretaria.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS role_accumulations jsonb NOT NULL DEFAULT '{}';

-- Função helper: retorna true se o usuário logado tem a role indicada
-- de forma direta OU via acúmulo configurado na organização.
CREATE OR REPLACE FUNCTION auth_has_effective_role(check_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  -- Acesso direto: usuário tem a role no organization_users
  SELECT EXISTS (
    SELECT 1
    FROM organization_users ou
    JOIN roles r ON r.id = ou.role_id
    WHERE ou.user_id         = auth.uid()
      AND ou.active          = true
      AND ou.organization_id = auth_organization_id()
      AND r.name             = check_role
  )
  -- Acesso acumulado: a role primária do usuário acumula a role pedida,
  -- conforme configurado em organizations.role_accumulations
  OR EXISTS (
    SELECT 1
    FROM organizations o
    JOIN organization_users ou ON ou.organization_id = o.id
    JOIN roles r               ON r.id               = ou.role_id
    WHERE o.id                 = auth_organization_id()
      AND ou.user_id           = auth.uid()
      AND ou.active            = true
      AND o.role_accumulations ? r.name
      AND o.role_accumulations -> r.name @> to_jsonb(check_role::text)
  );
$$;

-- Políticas RLS aditivas para tabelas com acesso restrito por papel.
-- O Postgres aplica políticas permissivas com OR, então estas se somam
-- às existentes sem substituí-las.

DROP POLICY IF EXISTS "accumulated_role_staff_profiles" ON staff_profiles;
CREATE POLICY "accumulated_role_staff_profiles"
  ON staff_profiles FOR SELECT
  USING (
    organization_id = auth_organization_id()
    AND auth_has_effective_role(auth_role())
  );

DROP POLICY IF EXISTS "accumulated_role_interest_forms" ON school_interest_forms;
CREATE POLICY "accumulated_role_interest_forms"
  ON school_interest_forms FOR SELECT
  USING (
    organization_id = auth_organization_id()
    AND auth_has_effective_role(auth_role())
  );
