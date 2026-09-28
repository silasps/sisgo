-- Bug pré-existente: lib/schools.ts define SCHOOL_TYPES com o valor
-- 'segundo_nivel' (mostrado no formulário de Nova escola como "Curso de
-- nível avançado") e o comentário lá é explícito que esse literal nunca
-- muda (API pública compara direto). Mas a constraint do banco só permitia
-- 'eted','udn','seminario','curso_online','voluntariado','outro' — sem
-- 'segundo_nivel'. Selecionar essa opção e criar a escola falhava
-- silenciosamente (erro só no log do servidor, a tela não avança).
alter table public.schools drop constraint if exists schools_school_type_check;
alter table public.schools add constraint schools_school_type_check
  check (school_type = any (array['eted','udn','seminario','curso_online','voluntariado','outro','segundo_nivel']));
