-- 055: divide escolas entre ETED e escolas de segundo nivel

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.schools'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%school_type%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.schools drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.schools
  add constraint schools_school_type_check
  check (school_type in ('eted','segundo_nivel','udn','seminario','curso_online','voluntariado','outro'));

insert into public.roles (name, label, description) values
  ('lider_eted', 'Lider de Escola', 'Gestao da sua escola: alunos, inscricoes, obreiros e turmas'),
  ('obreiro_eted', 'Obreiro de Escola', 'Acesso restrito a escola onde serve')
on conflict (name) do nothing;

update public.roles
set label = 'Lider de Escola',
    description = 'Gestao da sua escola: alunos, inscricoes, obreiros e turmas'
where name = 'lider_eted';

update public.roles
set label = 'Obreiro de Escola',
    description = 'Acesso restrito a escola onde serve'
where name = 'obreiro_eted';
