create table if not exists system_settings (
  key   text primary key,
  value text not null
);

alter table system_settings enable row level security;

create policy "superadmin read" on system_settings
  for select using (is_superadmin());

create policy "superadmin write" on system_settings
  for all using (is_superadmin()) with check (is_superadmin());
