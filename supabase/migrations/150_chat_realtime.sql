-- ============================================================
-- SISGO — Migration 150: Chat — RLS sem recursão + Realtime
-- ============================================================
--
-- 1. A policy de SELECT de chat_participants consultava a própria tabela, e
--    as outras policies do chat consultam chat_participants — qualquer
--    leitura feita como usuário (não service role) dava
--    "infinite recursion detected in policy for relation chat_participants".
--    O app não sentia porque o Chat lê tudo pelo service role, mas o
--    Realtime entrega cada evento avaliando a RLS como o usuário, então sem
--    isso nenhuma mensagem chegaria ao vivo. (Ela também comparava
--    cp2.conversation_id com ele mesmo — sempre verdadeiro — e deixava
--    qualquer participante ler todas as participações.)
--    Mesmo padrão de is_superadmin()/auth_organization_id(): uma função
--    SECURITY DEFINER olha chat_participants sem passar pela RLS dela.
--
-- 2. Mensagens e reações entram na publicação do Realtime: a conversa aberta
--    recebe na hora o que a outra pessoa manda, edita, apaga ou reage.

create or replace function public.is_chat_participant(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_participants
    where conversation_id = target_conversation_id and user_id = auth.uid()
  );
$$;

drop policy if exists "chat_participants - own select" on public.chat_participants;
create policy "chat_participants - own select" on public.chat_participants
  for select using (
    is_superadmin() or user_id = auth.uid() or public.is_chat_participant(conversation_id)
  );

drop policy if exists "chat_conversations - participant select" on public.chat_conversations;
create policy "chat_conversations - participant select" on public.chat_conversations
  for select using (is_superadmin() or public.is_chat_participant(id));

drop policy if exists "chat_messages - participant select" on public.chat_messages;
create policy "chat_messages - participant select" on public.chat_messages
  for select using (is_superadmin() or public.is_chat_participant(conversation_id));

drop policy if exists "chat_messages - participant insert" on public.chat_messages;
create policy "chat_messages - participant insert" on public.chat_messages
  for insert with check (author_id = auth.uid() and public.is_chat_participant(conversation_id));

drop policy if exists "chat_message_reactions - participant select" on public.chat_message_reactions;
create policy "chat_message_reactions - participant select" on public.chat_message_reactions
  for select using (
    is_superadmin()
    or exists (
      select 1 from public.chat_messages m
      where m.id = message_id and public.is_chat_participant(m.conversation_id)
    )
  );

alter publication supabase_realtime add table public.chat_messages, public.chat_message_reactions;
