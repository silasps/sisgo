-- Novos campos do formulário de inscrição (base de origem, meio de
-- transporte, necessidades de acomodação, nome do cônjuge) nascem VISÍVEIS
-- por padrão em qualquer escola cujo form_config.hidden_fields não os
-- mencione (ver H/hidden_fields em FormularioInscricao.tsx). Sem esta
-- migration, todas as escolas já cadastradas passariam a mostrar esses
-- campos novos do nada. Esconde por padrão nas escolas existentes — a
-- escola nova (ex. "DNA Jocum 2027") nasce sem essas chaves em
-- hidden_fields, então os vê normalmente.
update schools
set form_config = jsonb_set(
  coalesce(form_config, '{}'::jsonb),
  '{hidden_fields}',
  coalesce(form_config->'hidden_fields', '[]'::jsonb)
    || '["s4.base_origem","s4.meio_transporte","s4.necessidades_acomodacao","s5.conjuge_nome"]'::jsonb
)
where not (coalesce(form_config->'hidden_fields', '[]'::jsonb) @> '["s4.base_origem"]'::jsonb);
