-- ============================================================
-- SISGO — Migration 130: rastreio de envio de credenciais de acesso
-- ============================================================
--
-- Import em massa de pessoas pode criar o login (auth.users +
-- organization_users) sem disparar o email de boas-vindas na hora — por
-- exemplo, pra dar tempo do DH testar o cadastro antes de avisar a pessoa.
-- `invite_sent_at` nulo marca "login criado, credenciais ainda não
-- enviadas"; é preenchido quando o email de fato sai (na hora do import ou
-- num envio em massa posterior).

alter table organization_users
  add column if not exists invite_sent_at timestamptz;
