-- 136: carga horária total da escola, em horas (campo estruturado)
--
-- duration_description continua existindo (texto livre pra página pública,
-- ex. "20 semanas (5 meses)") — duration_hours é o número usado internamente
-- (ex. certificados, alerta de cadastro incompleto na aba Geral da escola)
-- pra não depender de interpretar texto livre.

alter table schools add column if not exists duration_hours integer;
