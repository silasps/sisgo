-- ============================================================
-- SISGO — Migration 152: Chat — "entregue" (✓✓ cinza)
-- ============================================================
--
-- Igual ao WhatsApp: ✓ = chegou no servidor, ✓✓ cinza = chegou no aparelho
-- da outra pessoa, ✓✓ azul = ela viu (last_read_at, migration 151).
-- "Chegou no aparelho" = o SISGO está aberto em algum lugar pra ela (o
-- ouvinte global ChatDeliveryListener recebeu a mensagem pelo Realtime) ou
-- ela abriu/voltou pro app depois do envio.
--
-- A função usa o now() do BANCO — o mesmo relógio do created_at da
-- mensagem — pra nenhuma diferença de relógio entre servidor da aplicação e
-- banco deixar uma mensagem entregue com um certinho só. Só mexe nas
-- conversas que têm mensagem nova da outra pessoa, pra não gerar evento de
-- Realtime à toa a cada tela aberta. Só o service role chama (a pessoa já
-- vem autenticada pela server action markChatDelivered).

alter table public.chat_participants
  add column if not exists last_delivered_at timestamptz;

create or replace function public.mark_chat_delivered(p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.chat_participants cp
     set last_delivered_at = now()
   where cp.user_id = p_user_id
     and exists (
       select 1 from public.chat_messages m
       where m.conversation_id = cp.conversation_id
         and m.author_id <> p_user_id
         and m.created_at > coalesce(cp.last_delivered_at, '-infinity'::timestamptz)
     );
$$;

revoke execute on function public.mark_chat_delivered(uuid) from public, anon, authenticated;
grant execute on function public.mark_chat_delivered(uuid) to service_role;
