-- Configuração do formulário por TURMA (antes só por escola, ver migration
-- 051). Mesmo shape de schools.form_config ({ hidden_fields: [...] }), sem
-- payment_info (pagamento continua só por escola). NULL = turma ainda não
-- tem config própria, herda schools.form_config inteiro (ver
-- resolveFormConfig em src/lib/school/formConfig.ts).
-- form_config_confirmed aciona o banner de "cadastro incompleto" na página
-- da turma: nasce true nas turmas já existentes (sem nudge retroativo) e
-- false nas turmas novas até alguém salvar a config pela primeira vez.
alter table school_classes
  add column if not exists form_config jsonb,
  add column if not exists form_config_confirmed boolean not null default true;
