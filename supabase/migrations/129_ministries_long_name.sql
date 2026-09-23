-- ============================================================
-- SISGO — Migration 129: nome longo do ministério
-- ============================================================
--
-- `ministries.name` já funciona como identificador curto na prática (ex.
-- "CM", "ETED Reaviva") — cada organização pode preencher `long_name` com
-- a forma por extenso ("Comunicação e Mobilização", "ETED Reforma e
-- Avivamento") pra usar em lugares com espaço de sobra, mantendo `name`
-- como está em todo o resto do sistema. Opcional: quando vazio, a UI cai
-- de volta pro `name`.

alter table ministries
  add column if not exists long_name text;
