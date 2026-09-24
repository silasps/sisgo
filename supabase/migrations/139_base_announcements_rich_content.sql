-- 139: conteúdo rico pra anúncios da base (Comunicação) — imagem com ponto
-- focal (upload único + reposicionamento sem reenviar arquivo), link de
-- chamada pra ação, categoria e agendamento de publicação.

alter table public.base_announcements
  add column if not exists image_url text,
  add column if not exists image_focal_x smallint not null default 50,
  add column if not exists image_focal_y smallint not null default 50,
  add column if not exists link_url text,
  add column if not exists link_label text,
  add column if not exists category text not null default 'aviso',
  add column if not exists publish_at timestamptz;

alter table public.base_announcements
  drop constraint if exists base_announcements_category_check;
alter table public.base_announcements
  add constraint base_announcements_category_check
  check (category in ('aviso', 'evento', 'oportunidade', 'urgente'));

alter table public.base_announcements
  drop constraint if exists base_announcements_focal_x_check;
alter table public.base_announcements
  add constraint base_announcements_focal_x_check
  check (image_focal_x between 0 and 100);

alter table public.base_announcements
  drop constraint if exists base_announcements_focal_y_check;
alter table public.base_announcements
  add constraint base_announcements_focal_y_check
  check (image_focal_y between 0 and 100);
