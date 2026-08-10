-- ============================================================
-- Papel "Comunicação"
--
-- Já existia como opção de "função vinculada" ao criar um Ministério
-- (LINKABLE_ROLES em /[slug]/ministerios/nova) e como item de menu
-- condicionado a esse papel (buildNav em layout.tsx), mas a role nunca
-- tinha sido criada — vincular um ministério a "Comunicação" nunca dava
-- acesso a ninguém.
-- ============================================================

insert into roles (name, label, description) values
  ('comunicacao', 'Comunicação', 'Gestão de comunicação da base — vinculado a um ministério')
on conflict (name) do nothing;
