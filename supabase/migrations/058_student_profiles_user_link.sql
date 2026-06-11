-- 058: vinculo entre login do aluno e perfil de aluno

alter table public.student_profiles
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_student_profiles_user_id
  on public.student_profiles(user_id);

drop policy if exists "student_profiles - self user select" on public.student_profiles;

create policy "student_profiles - self user select" on public.student_profiles
  for select using (
    user_id = auth.uid()
    and organization_id = auth_organization_id()
  );

drop policy if exists "school_calendar_events - org select" on public.school_calendar_events;
drop policy if exists "school_calendar_events - scoped select" on public.school_calendar_events;

create policy "school_calendar_events - scoped select" on public.school_calendar_events
  for select using (
    is_superadmin()
    or (
      organization_id = auth_organization_id()
      and auth_role() in ('admin_base','lider_base','dh','secretaria','hospitalidade','cozinha','lider_eted','obreiro_eted')
    )
    or (
      organization_id = auth_organization_id()
      and auth_role() = 'aluno'
      and exists (
        select 1
        from public.student_profiles sp
        join public.class_students cs on cs.person_id = sp.person_id and cs.status = 'ativo'
        join public.school_classes sc on sc.id = cs.class_id
        where sp.user_id = auth.uid()
          and sp.active = true
          and sp.organization_id = school_calendar_events.organization_id
          and sc.school_id = school_calendar_events.school_id
      )
    )
  );
