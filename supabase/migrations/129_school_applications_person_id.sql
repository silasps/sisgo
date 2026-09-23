-- ============================================================
-- SISGO — Migration 129: person_id em school_applications
-- ============================================================
--
-- staff_applications já nasceu com person_id (migration 001), mas
-- school_applications nunca precisou — hoje ela só é resolvida via
-- token (candidato sem login) ou via interest_form_id. O import de
-- pessoas (autoatendimento, pessoa já ativa/logada) precisa achar a
-- "candidatura" de cadastro-em-etapas de um aluno pelo person_id
-- dele direto, sem depender de token guardado em outro lugar.

alter table school_applications
  add column if not exists person_id uuid references people(id) on delete cascade;

create index if not exists school_applications_person_id_idx
  on school_applications(person_id);
