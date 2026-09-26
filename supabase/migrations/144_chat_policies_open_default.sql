-- Default é tudo liberado ("todo mundo tem acesso a todo mundo na
-- instituição") até a base entrar em Configurações e restringir — não
-- 'proprio_grupo' como a 143 tinha colocado. Sem efeito em dados (nenhuma
-- organização salvou política ainda; o fallback em código também já reflete
-- isso, este ALTER só alinha o default da coluna com a intenção real).
alter table public.chat_policies alter column aluno_escopo set default 'qualquer_um';
