-- Quarto modelo fixo de formulário ("Escola") — cobre school_type que não
-- são eted/seminario/evento (segundo_nivel, outro). Ver
-- src/lib/school/formConfig.ts (FORM_TEMPLATE_NAMES): os modelos
-- reaproveitáveis agora são só estes 4 nomes fixos, não mais texto livre.
insert into school_form_templates (organization_id, name, form_config)
select o.id, 'Escola', '{"hidden_fields": []}'::jsonb
from organizations o
where not exists (
  select 1 from school_form_templates t
  where t.organization_id = o.id and t.name = 'Escola'
);
