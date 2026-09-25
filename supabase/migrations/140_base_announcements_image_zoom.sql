-- 140: zoom do ponto focal do anúncio — complementa image_focal_x/y (139).
-- Sem isso, o ponto focal só escolhe ONDE focar, nunca QUANTO aproximar
-- antes: uma foto quadrada/vertical numa vitrine bem larga (carrossel do
-- banner de área) sempre mostrava só uma tira fina da imagem, não importava
-- onde o foco estava. 100 = 1x (sem zoom, comportamento de antes),
-- até 300 = 3x — mesmo range de zoom já usado em AvatarCropperModal.

alter table public.base_announcements
  add column if not exists image_zoom smallint not null default 100;

alter table public.base_announcements
  drop constraint if exists base_announcements_image_zoom_check;
alter table public.base_announcements
  add constraint base_announcements_image_zoom_check
  check (image_zoom between 100 and 300);
