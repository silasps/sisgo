-- ============================================================
-- SISGO — Migration 090: Idiomas de atendimento da base
-- ============================================================
--
-- Distingue "língua materna" do candidato (LANGUAGES completo) de "em qual
-- idioma a base consegue atendê-lo" — uma lista configurada pela própria
-- base em Configurações, separada por módulo (obreiros x alunos), porque
-- a capacidade de atendimento pode ser diferente entre as duas equipes.

alter table organizations
  add column if not exists staff_communication_languages   jsonb not null default '[]'::jsonb,
  add column if not exists student_communication_languages jsonb not null default '[]'::jsonb;

alter table staff_interest_forms
  add column if not exists communication_language text;

alter table school_interest_forms
  add column if not exists communication_language text;
