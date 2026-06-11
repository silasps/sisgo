-- Migra envio de e-mail para Resend (serviço centralizado, sem credenciais por escola)

-- Remove coluna de senha de app (não é mais necessária)
alter table schools drop column if exists smtp_password;

-- Log de todos os envios de e-mail pelo sistema (para controle de quota do Resend free tier)
create table email_logs (
  id              uuid primary key default gen_random_uuid(),
  sent_at         timestamptz not null default now(),
  organization_id uuid references organizations(id) on delete set null,
  school_id       uuid references schools(id) on delete set null,
  to_email        text not null,
  status          text not null default 'sent',  -- 'sent' | 'failed'
  error           text
);

alter table email_logs enable row level security;

-- Somente service_role pode inserir/atualizar (server-side)
create policy "email_logs_service_role_write" on email_logs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
