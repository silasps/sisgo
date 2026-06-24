-- 081: fonte e cor de texto nas mensagens do mural

alter table public.ministry_messages
  add column if not exists font smallint not null default 0,
  add column if not exists text_color smallint not null default 0,
  add column if not exists font_size smallint not null default 1;
