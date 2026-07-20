-- 107: liga/desliga por evento se ele aparece pro aluno (padrão: visível)

alter table public.school_calendar_events
  add column if not exists visible_to_students boolean not null default true;
