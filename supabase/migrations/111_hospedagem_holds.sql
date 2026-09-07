-- ============================================================
-- SISGO — Migration 111: reserva de bloco/andar inteiro (hold)
-- ============================================================
--
-- A hospitalidade precisa poder marcar um bloco ou andar inteiro como
-- "reservado pro Grupo X, de tal a tal data" ANTES de saber quem fica em
-- qual cama — é só um bloqueio/aviso, não aloca nenhuma cama sozinho. A
-- distribuição cama a cama continua acontecendo do jeito que já existe
-- (room_allocations, via createAllocation/allocateWholeRoom), sem relação
-- direta com essa tabela.

create table space_holds (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scope           text not null check (scope in ('block','floor')),
  block_id        uuid not null references blocks(id) on delete cascade,
  floor_id        uuid references floors(id) on delete cascade,
  group_name      text not null,
  starts_at       date not null,
  ends_at         date not null,
  notes           text,
  status          text not null default 'ativo' check (status in ('ativo','cancelado')),
  cancel_reason   text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  cancelled_at    timestamptz,
  check ((scope = 'floor' and floor_id is not null) or (scope = 'block' and floor_id is null))
);
create index space_holds_org_idx on space_holds(organization_id);
create index space_holds_block_idx on space_holds(block_id);
create index space_holds_floor_idx on space_holds(floor_id);
