-- Escola "vinculada" a um ministério — o ministério continua existindo como
-- está (chat, tarefas, membros), mas também gerencia uma escola de verdade
-- (turmas, matrícula, formulário de inscrição de aluno). Ex.: ETED Louvor,
-- Seminário SOS — são ministério e escola ao mesmo tempo. Quem lidera o
-- ministério passa a liderar a escola vinculada também (ver
-- lib/auth/unit-access.ts, getMySchools).
alter table public.schools
  add column if not exists linked_ministry_id uuid references public.ministries(id) on delete set null;

create unique index if not exists schools_linked_ministry_id_unique
  on public.schools(linked_ministry_id) where linked_ministry_id is not null;
