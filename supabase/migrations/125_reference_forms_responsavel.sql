-- ============================================================
-- SISGO — Migration 125: novo tipo de referência "responsavel"
-- ============================================================
--
-- Candidato a obreiro menor de idade: em vez de declarar "sou maior de
-- 18 anos", informa os dados do responsável legal e o sistema envia um
-- e-mail pra ele(a) confirmar autorização — reaproveita a mesma infra de
-- reference_forms (token público, e-mail, form_data) já usada pra
-- pastor/amigo/liderança de experiência.

alter table reference_forms
  drop constraint if exists reference_forms_type_check;

alter table reference_forms
  add constraint reference_forms_type_check
  check (type in ('pastor', 'amigo', 'lideranca_experiencia', 'responsavel'));
