-- Permite anexar uma service_requests a uma pré-inscrição (school_interest_forms
-- / staff_interest_forms), não só à candidatura já convertida
-- (school_application_id / staff_application_id, adicionadas nas migrations
-- 099/102). Usado pela solicitação de transferência de escola/ministério que
-- líder de ETED/ministério pode abrir — o DH resolve depois usando o
-- mecanismo de encaminhar que já existe, sem fluxo bespoke novo.
alter table service_requests
  add column if not exists school_interest_form_id uuid references school_interest_forms(id) on delete cascade,
  add column if not exists staff_interest_form_id uuid references staff_interest_forms(id) on delete cascade;
