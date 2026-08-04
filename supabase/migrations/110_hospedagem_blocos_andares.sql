-- ============================================================
-- SISGO — Migration 110: hierarquia real Bloco > Andar > Quarto > Cama
-- ============================================================
--
-- Até aqui, "bloco" e "andar" eram texto livre em `rooms.block`/
-- `rooms.floor` — sem entidade própria, sem como renomear um bloco/andar
-- inteiro de uma vez, sem público padrão por andar. Isso promove os dois a
-- tabelas de verdade, com `rooms.floor_id` apontando pro andar (e o andar
-- carregando o bloco). `destination`/`gender_constraint` continuam
-- existindo em `rooms` como estão hoje — servem de override por quarto; o
-- andar só carrega um *padrão* pros quartos novos herdarem ao serem
-- criados.

create table blocks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  display_order   int not null default 0,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index blocks_org_idx on blocks(organization_id);

create table floors (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  block_id           uuid not null references blocks(id) on delete restrict,
  name               text not null,
  destination        text check (destination in ('visita','aluno','obreiro')),
  gender_constraint  text check (gender_constraint in ('masculino','feminino','misto')),
  display_order      int not null default 0,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now()
);
create index floors_org_idx on floors(organization_id);
create index floors_block_idx on floors(block_id);

alter table rooms add column floor_id uuid references floors(id) on delete restrict;

-- Backfill: agrupa os quartos existentes por (block, floor) texto, cria um
-- bloco + andar por combinação distinta, aponta floor_id. Escrito de forma
-- genérica (não hardcoded pra um quarto específico) — hoje só existe
-- 1 quarto real na base, mas isso cobre qualquer estado real na hora de
-- rodar.
do $$
declare
  r record;
  v_block_id uuid;
  v_floor_id uuid;
begin
  for r in
    select distinct organization_id, coalesce(block, 'Sem bloco') as block_name, coalesce(nullif(floor, ''), 'Sem andar') as floor_name
    from rooms
    where floor_id is null
  loop
    select id into v_block_id from blocks where organization_id = r.organization_id and name = r.block_name;
    if v_block_id is null then
      insert into blocks (organization_id, name) values (r.organization_id, r.block_name) returning id into v_block_id;
    end if;

    select id into v_floor_id from floors where block_id = v_block_id and name = r.floor_name;
    if v_floor_id is null then
      insert into floors (organization_id, block_id, name) values (r.organization_id, v_block_id, r.floor_name) returning id into v_floor_id;
    end if;

    update rooms set floor_id = v_floor_id
      where organization_id = r.organization_id
        and coalesce(block, 'Sem bloco') = r.block_name
        and coalesce(nullif(floor, ''), 'Sem andar') = r.floor_name
        and floor_id is null;
  end loop;
end $$;

alter table rooms drop column block;
alter table rooms drop column floor;
