-- ============================================================
-- SISGO — Migration 093: novo tipo de referência "lideranca_experiencia"
-- ============================================================
--
-- reference_forms.type hoje só aceita 'pastor'/'amigo'. O formulário de
-- obreiro passa a perguntar qual foi a experiência mais recente do
-- candidato (escola desta instituição ou missão) e pedir o contato de UMA
-- liderança daquele período — esse tipo cobre os dois casos (o contexto
-- exato fica em staff_applications.form_data).

alter table reference_forms
  drop constraint if exists reference_forms_type_check;

alter table reference_forms
  add constraint reference_forms_type_check
  check (type in ('pastor', 'amigo', 'lideranca_experiencia'));
