-- Novo school_type 'evento' (alguns dias na instituição, sem pré-inscrição —
-- ver isDirectEnrollmentType em src/lib/schools.ts), precisa entrar na lista
-- permitida pelo check constraint.
alter table schools drop constraint schools_school_type_check;
alter table schools add constraint schools_school_type_check
  check (school_type = any (array['eted','udn','seminario','evento','curso_online','voluntariado','outro','segundo_nivel']));
