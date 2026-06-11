-- SISGO - Fluxo de efetivação de obreiros com login obrigatório

insert into roles (name, label, description) values
  ('obreiro_ministerio', 'Obreiro de Ministério', 'Acesso restrito ao ministério onde serve')
on conflict (name) do nothing;

alter table staff_applications
  add column if not exists leader_accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists leader_accepted_at timestamptz,
  add column if not exists dh_finalized_by uuid references auth.users(id) on delete set null,
  add column if not exists dh_finalized_at timestamptz;

alter table staff_profiles
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists accepted_at timestamptz;

create index if not exists idx_staff_profiles_user_id
  on staff_profiles(user_id);

drop policy if exists "staff_profiles - self user select" on staff_profiles;

create policy "staff_profiles - self user select" on staff_profiles
  for select using (
    user_id = auth.uid()
    and organization_id = auth_organization_id()
  );
