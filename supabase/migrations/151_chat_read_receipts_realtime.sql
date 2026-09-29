-- ============================================================
-- SISGO — Migration 151: Chat — confirmação de leitura ao vivo
-- ============================================================
--
-- Os dois "certinhos" (✓✓) de uma mensagem aparecem quando o last_read_at
-- da outra pessoa em chat_participants passa do horário da mensagem. Com a
-- tabela no Realtime, quem mandou vê o ✓ virar ✓✓ na hora em que a outra
-- pessoa abre a conversa. A RLS de chat_participants (migration 150) já
-- limita os eventos às conversas de que a pessoa participa.

alter publication supabase_realtime add table public.chat_participants;
