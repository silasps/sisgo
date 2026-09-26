-- Rastreio de leitura do mural de escola, espelhando
-- ministry_message_reads (migration 097) — a escola nunca teve isso, o
-- badge de "mensagem nova" usava só uma janela de 24h. Unificar mural de
-- ministério/escola dentro do Chat institucional (ver plano) é a hora certa
-- de dar à escola o mesmo rastreio de verdade que o ministério já tem.
create table if not exists public.school_message_reads (
  user_id     uuid not null references auth.users(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, school_id)
);

alter table public.school_message_reads enable row level security;

create policy "school_message_reads - own" on public.school_message_reads
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
