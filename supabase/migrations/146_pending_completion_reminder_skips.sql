-- Quantas vezes a pessoa já adiou o aviso "Cadastro incompleto" (candidatura
-- própria em rascunho, ver [slug]/(admin)/layout.tsx). Vinculado à
-- candidatura, não ao navegador (era localStorage) — pra não se perder ao
-- trocar de dispositivo, já que a pessoa está logada quando o aviso aparece.
alter table public.school_applications
  add column if not exists reminder_skips integer not null default 0;

alter table public.staff_applications
  add column if not exists reminder_skips integer not null default 0;
