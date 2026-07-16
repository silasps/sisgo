-- 098: rastreia edição de mensagens do chat de ministério

alter table public.ministry_messages add column if not exists edited_at timestamptz;
