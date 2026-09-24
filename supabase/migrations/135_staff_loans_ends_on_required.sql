-- 135: data de término do empréstimo de obreiro vira obrigatória
--
-- Sem isso, o líder de origem aprova sem saber se o período cabe na agenda
-- da própria unidade — precisa do intervalo completo (início e fim) pra
-- decidir se dá pra emprestar. Tabela recém-criada (migration 134), 0
-- linhas em produção — sem dado legado pra migrar.

alter table staff_loans alter column ends_on set not null;
