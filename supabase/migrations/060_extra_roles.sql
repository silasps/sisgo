-- 060: Funções extras por pessoa
-- O DH pode atribuir roles adicionais a um obreiro específico.
-- Ex: a pessoa que é Secretaria também acumula Cozinha individualmente.
-- Diferente de role_accumulations (nível da base), isso é por pessoa.

ALTER TABLE organization_users
  ADD COLUMN IF NOT EXISTS extra_roles jsonb NOT NULL DEFAULT '[]';
