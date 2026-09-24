-- ============================================================
-- SISGO — Migration 132: acesso de emergência ao perfil da pessoa
-- ============================================================
--
-- "Break-glass access" — líder de ministério/escola não tem acesso ao
-- perfil completo da pessoa (isso é do DH/superadmin), mas em situação de
-- força maior (proteção da vida/incolumidade — LGPD Art. 11, II, "e")
-- pode abrir um recorte limitado de dados (contato, CPF, endereço — nunca
-- saúde clínica nem financeiro) mediante justificativa obrigatória.
-- Concessão é imediata (emergência não espera aprovação prévia — mesmo
-- padrão do "break the glass" de prontuário eletrônico), expira sozinha,
-- e fica com registro auditável pro DH revisar depois.

create table person_emergency_access (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  person_id       uuid not null references people(id) on delete cascade,
  requested_by    uuid not null references auth.users(id),
  reason_category text not null check (reason_category in ('saude_seguranca', 'contato_urgente', 'outro')),
  reason_text     text not null,
  granted_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  revoked_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index person_emergency_access_person_idx on person_emergency_access(person_id, expires_at);
create index person_emergency_access_org_idx on person_emergency_access(organization_id, granted_at desc);
