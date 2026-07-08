-- ============================================================
-- SISGO — Migration 089: Escola como destino de pré-inscrição de obreiro
-- ============================================================
--
-- Estruturalmente, uma escola também recebe obreiros para trabalhar nela
-- (o processo de captação é conduzido pelo DH, igual ao de um ministério).
-- As nomenclaturas continuam distintas — ministério é ministério, escola é
-- escola — mas ambas passam a ser destinos possíveis de uma pré-inscrição
-- de obreiro, mutuamente exclusivos.

alter table staff_interest_forms
  add column if not exists school_id uuid references schools(id) on delete set null;
alter table staff_applications
  add column if not exists school_id uuid references schools(id) on delete set null;

alter table staff_interest_forms
  add constraint staff_interest_forms_dest_check
  check (ministry_id is null or school_id is null);
alter table staff_applications
  add constraint staff_applications_dest_check
  check (ministry_id is null or school_id is null);

-- Mesmo padrão de "staff_applications - lider_ministerio" (013_staff_ministry_dept_config.sql):
-- dá ao líder da escola o mesmo nível de acesso que o líder de ministério já tem.
create policy "staff_applications - lider_eted" on staff_applications
  for all using (
    auth_role() = 'lider_eted'
    and school_id is not null
    and exists (
      select 1 from school_leaders sl
      where sl.school_id = staff_applications.school_id and sl.user_id = auth.uid()
    )
  );
