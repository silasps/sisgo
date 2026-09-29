-- Editar/excluir a própria mensagem (janela de tempo, ver
-- chat/config.ts) — migration 143 só tinha select/insert em
-- chat_messages. RLS aqui é defesa em profundidade (mesmo padrão do
-- resto do módulo); a janela de tempo é decidida na aplicação
-- (editMessage/deleteMessage, actions.ts), não dá pra expressar limpo
-- em RLS puro.
create policy "chat_messages - author update" on public.chat_messages
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "chat_messages - author delete" on public.chat_messages
  for delete using (author_id = auth.uid());
