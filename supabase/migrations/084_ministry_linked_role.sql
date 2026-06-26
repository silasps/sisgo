-- Vincula um ministério a uma função do sistema (hospitalidade, secretaria, dh, etc.)
-- Membros desse ministério ganham acesso ao módulo correspondente.
ALTER TABLE ministries ADD COLUMN linked_role text;

ALTER TABLE ministries ADD CONSTRAINT ministries_org_linked_role_unique
  UNIQUE (organization_id, linked_role);
