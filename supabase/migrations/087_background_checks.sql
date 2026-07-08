-- ============================================================
-- SISGO — Migration 087: Verificação de antecedentes criminais (obreiros)
-- ============================================================
-- Rastreio manual: o SISGO não consulta portais governamentais (Polícia
-- Federal, SSP, equivalentes estrangeiros) — exigem login pessoal do
-- candidato. O DH registra status + observação; a certidão em si é
-- conferida fora do sistema. Sem upload de arquivo nesta feature (o
-- upload de documentos do formulário de obreiro tem um gap de
-- persistência pré-existente, fora de escopo aqui).

create table if not exists background_checks (
  id                    uuid        primary key default uuid_generate_v4(),
  organization_id       uuid        not null references organizations(id) on delete cascade,
  staff_application_id  uuid        not null references staff_applications(id) on delete cascade,
  person_id             uuid        references people(id) on delete set null,
  check_type            text        not null check (check_type in (
                          'pf_federal',
                          'ssp_estadual',
                          'police_clearance_estrangeiro',
                          'autodeclaracao_conduta',
                          'referencia_conduta_menores',
                          'outro'
                        )),
  country               text,
  status                text        not null default 'pendente' check (status in (
                          'pendente', 'solicitado', 'em_analise', 'aprovado', 'reprovado', 'nao_aplicavel'
                        )),
  issued_at             date,
  expires_at            date,
  notes                 text,
  flagged_concern       boolean     not null default false,
  reviewed_by           uuid        references auth.users(id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists background_checks_org_idx on background_checks(organization_id);
create index if not exists background_checks_application_idx on background_checks(staff_application_id);
create index if not exists background_checks_status_idx on background_checks(organization_id, status);

alter table background_checks enable row level security;

create policy "background_checks_admin_all" on background_checks
  for all using (
    is_superadmin() or (
      organization_id = auth_organization_id() and
      auth_role() in ('admin_base', 'lider_base', 'dh')
    )
  );

create trigger set_background_checks_updated_at
  before update on background_checks
  for each row execute function set_updated_at();

-- ============================================================
-- Notificação seletiva: só quando reprovado ou sinalizado como
-- preocupante (evita ruído das transições rotineiras de status).
-- ============================================================
create or replace function queue_background_check_notification()
returns trigger as $$
begin
  if (new.status = 'reprovado' and old.status is distinct from 'reprovado')
     or (new.flagged_concern = true and coalesce(old.flagged_concern, false) = false) then
    insert into notification_events (event_type, payload)
    values ('background_check_concern', jsonb_build_object(
      'table_name', 'background_checks',
      'record_id', new.id,
      'organization_id', new.organization_id,
      'staff_application_id', new.staff_application_id,
      'check_type', new.check_type,
      'new_status', new.status,
      'flagged_concern', new.flagged_concern
    ));
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_notify_background_check_concern
  after update on background_checks
  for each row execute function queue_background_check_notification();
