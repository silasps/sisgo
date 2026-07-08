-- ============================================================
-- SISGO — Migration 088: Página pública de ministérios
-- ============================================================
--
-- Espelha o padrão já usado em schools (003_schools_public_page.sql +
-- 085_public_api.sql): slug/subtitle/hero_image_url/is_public + policy de
-- leitura pública. `description` (já existente) segue como o texto longo
-- exibido na página pública — não precisa de um `long_description` novo.

alter table ministries
  add column if not exists slug            text unique,
  add column if not exists subtitle        text,
  add column if not exists hero_image_url  text,
  add column if not exists is_public       boolean not null default false;

-- Mesmo padrão de schools_public_read (085_public_api.sql)
create policy "ministries_public_read" on ministries
  for select using (is_public = true and active = true);
