-- 106: audiência por papel nos eventos de base + acesso do Ministério de Comunicação

alter table public.base_calendar_events
  add column if not exists visible_to_roles text[];

-- Ministério de Comunicação (via ministries.linked_role = 'comunicacao') pode criar
-- eventos de base, além de admin_base/lider_base/superadmin (policy já existente).
create policy "base_calendar_events - comunicacao insert" on public.base_calendar_events
  for insert with check (
    organization_id = auth_organization_id()
    and auth_role() in ('lider_ministerio', 'obreiro_ministerio')
    and (
      exists (
        select 1
        from public.ministries m
        join public.ministry_leaders ml on ml.ministry_id = m.id and ml.user_id = auth.uid()
        where m.organization_id = base_calendar_events.organization_id
          and m.linked_role = 'comunicacao'
      )
      or exists (
        select 1
        from public.ministries m
        join public.ministry_members mm on mm.ministry_id = m.id and mm.active = true
        join public.staff_profiles sp on sp.person_id = mm.person_id and sp.user_id = auth.uid()
        where m.organization_id = base_calendar_events.organization_id
          and m.linked_role = 'comunicacao'
      )
    )
  );

-- Comunicação só edita/apaga os próprios eventos (não mexe em feriado/trimestre do DH).
create policy "base_calendar_events - comunicacao manage own" on public.base_calendar_events
  for update using (
    created_by = auth.uid()
    and organization_id = auth_organization_id()
    and auth_role() in ('lider_ministerio', 'obreiro_ministerio')
  )
  with check (
    created_by = auth.uid()
    and organization_id = auth_organization_id()
    and auth_role() in ('lider_ministerio', 'obreiro_ministerio')
  );

create policy "base_calendar_events - comunicacao delete own" on public.base_calendar_events
  for delete using (
    created_by = auth.uid()
    and organization_id = auth_organization_id()
    and auth_role() in ('lider_ministerio', 'obreiro_ministerio')
  );
