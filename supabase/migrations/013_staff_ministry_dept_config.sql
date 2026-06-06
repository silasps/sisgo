-- ============================================================
-- SISGO — Migration 013: Preparativos para inscrição de obreiros
--         e configuração de departamentos por base
-- ============================================================

-- ── 1. ministry_id em staff_applications ─────────────────────
-- Permite que um candidato a obreiro indique o ministério que deseja servir.
-- Usado pelo líder do ministério para avaliar a candidatura.
alter table staff_applications
  add column if not exists ministry_id uuid references ministries(id);

-- RLS: lider_ministerio pode ler/atualizar candidatos do seu ministério
create policy "staff_applications - lider_ministerio" on staff_applications
  for all using (
    auth_role() = 'lider_ministerio'
    and ministry_id is not null
    and exists (
      select 1 from ministry_leaders ml
      where ml.ministry_id = staff_applications.ministry_id
        and ml.user_id = auth.uid()
    )
  );

-- ── 2. department_assignments em organizations ────────────────
-- Mapa de departamento → papel responsável na base.
-- Permite bases sem hospitalidade redirecionarem para outro papel.
-- Padrão: hospitalidade → 'hospitalidade', secretaria → 'secretaria'
alter table organizations
  add column if not exists department_assignments jsonb
  not null default '{"hospitalidade":"hospitalidade","secretaria":"secretaria"}'::jsonb;

-- ── 3. Remover CHECK fixo de service_requests.target_department ──
-- O roteamento agora é dinâmico via department_assignments.
-- O front-end valida os valores disponíveis de cada base.
alter table service_requests
  drop constraint if exists service_requests_target_department_check;
