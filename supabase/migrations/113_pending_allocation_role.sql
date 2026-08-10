-- ============================================================
-- Papel "Pendente de Alocação"
--
-- Usado quando o super admin empurra um usuário sem base (que se
-- cadastrou no sistema mas nunca ficou vinculado a nenhuma organização)
-- para uma base específica. O usuário entra na base com este papel
-- provisório, aparece no Quadro de Obreiros e o DH da base recebe uma
-- notificação para definir a área/função real dele.
-- ============================================================

insert into roles (name, label, description) values
  ('pendente_alocacao', 'Pendente de Alocação', 'Atribuído a esta base pelo super admin, aguardando o DH definir área e função')
on conflict (name) do nothing;
