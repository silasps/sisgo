-- Verificação de e-mail de contato das escolas (ETED)
alter table schools
  add column if not exists contact_email_verified     boolean     not null default false,
  add column if not exists contact_email_token        text,
  add column if not exists contact_email_token_expires_at timestamptz;
