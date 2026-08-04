-- ============================================================
-- SISGO — Migration 112: reserva de QUARTO inteiro (hold) também
-- ============================================================
--
-- space_holds (migration 111) só previa bloco/andar — mas a reserva certa
-- pra cada nível de navegação é a do que está sendo olhado ali (bloco na
-- tela de blocos, andar na tela de andares, quarto na tela de quartos), não
-- o container de onde veio. Adiciona scope='room' + room_id.

alter table space_holds add column room_id uuid references rooms(id) on delete cascade;

alter table space_holds drop constraint space_holds_scope_check;
alter table space_holds add constraint space_holds_scope_check check (scope in ('block','floor','room'));

alter table space_holds drop constraint space_holds_check;
alter table space_holds add constraint space_holds_check check (
  (scope = 'block' and floor_id is null and room_id is null) or
  (scope = 'floor' and floor_id is not null and room_id is null) or
  (scope = 'room' and room_id is not null)
);

create index space_holds_room_idx on space_holds(room_id);
