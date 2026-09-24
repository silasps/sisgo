-- 133: nome livre do tipo de escola (type_name)
--
-- schools.school_type continua com os mesmos valores de sempre ('eted',
-- 'seminario', 'segundo_nivel', 'udn', 'curso_online', 'voluntariado',
-- 'outro') — é usado por comportamento interno (formulário curto/matrícula
-- automática pra 'seminario') e por consumidores externos da API pública
-- (ex.: o site institucional em api/public/[slug]/events e
-- api/public/[slug]/schools fazem `school_type === 'eted'` direto), então
-- não pode ser renomeado sem quebrar esses sites. Em vez disso, a UI do
-- SISGO passa a rotular as poucas opções de forma genérica e a instituição
-- digita livremente um "nome do tipo" (ex.: "ETED", "Curso Técnico",
-- "Pós-graduação") guardado aqui — é isso que aparece nos cards/páginas
-- públicas dali pra frente, com school_type virando um detalhe interno de
-- categoria/comportamento.

alter table schools add column if not exists type_name text;

update schools set type_name = case school_type
  when 'eted'          then 'ETED'
  when 'seminario'      then 'Seminário'
  when 'udn'            then 'UDN'
  when 'segundo_nivel'  then 'Escola de 2º Nível'
  when 'curso_online'   then 'Curso Online'
  when 'voluntariado'   then 'Voluntariado'
  when 'outro'          then 'Outra escola'
  else 'Escola'
end
where type_name is null;

alter table schools alter column type_name set default 'Escola';
alter table schools alter column type_name set not null;
