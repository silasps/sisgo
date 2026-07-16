-- 093: rastreio de leitura do chat de ministério (some o alerta ao abrir, não só após 24h)

create table if not exists public.ministry_message_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, ministry_id)
);

alter table public.ministry_message_reads enable row level security;

create policy "ministry_message_reads - own" on public.ministry_message_reads
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
