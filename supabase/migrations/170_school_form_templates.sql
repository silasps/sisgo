-- Modelos de formulário reaproveitáveis por organização (ETED/Seminário/
-- Evento de início, mas o usuário pode editar e salvar novos a partir da
-- tela de configurar formulário de qualquer escola ou turma). Aplicados na
-- criação de escola (ver escolas/nova/page.tsx) e escolhidos livremente na
-- configuração de qualquer turma, independente do school_type da
-- escola-mãe (ex: uma turma avulsa de evento dentro de uma escola ETED).
create table if not exists school_form_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  form_config jsonb not null default '{}',
  -- "este é o modelo padrão aplicado ao criar escola/turma deste tipo";
  -- no máximo um por organização+tipo (índice parcial abaixo).
  default_for_school_type text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create unique index if not exists school_form_templates_default_per_type
  on school_form_templates (organization_id, default_for_school_type)
  where default_for_school_type is not null;

alter table school_form_templates enable row level security;

create policy "school_form_templates - org read" on school_form_templates
  for select using (is_superadmin() or organization_id = auth_organization_id());

create policy "school_form_templates - org write" on school_form_templates
  for all using (is_superadmin() or organization_id = auth_organization_id())
  with check (is_superadmin() or organization_id = auth_organization_id());

-- Semeia os 3 modelos atuais (mesmos hidden_fields hoje hardcoded em
-- escolas/nova/page.tsx) pra toda organização já existente, preservando o
-- comportamento atual sem quebra.
insert into school_form_templates (organization_id, name, form_config, default_for_school_type)
select id, 'ETED', '{"hidden_fields": []}'::jsonb, 'eted' from organizations
union all
select id, 'Seminário',
  '{"hidden_fields": ["s8.pastor_bloco", "s9.oculto", "s11.oculto", "s13.oculto", "s14.oculto"]}'::jsonb,
  'seminario' from organizations
union all
select id, 'Evento',
  '{"hidden_fields": ["s3.termo_8", "s3.termo_9", "s4.motivacao", "s4.conversou_equipe", "s4.conversou_com_quem", "s5.estudando", "s5.trabalha", "s5.servico_militar", "s5.passaporte", "s5.experiencias", "s5.habilidades", "s5.redes_bloco", "s6.oculto", "s7.situacao_familiar", "s7.filhos_dados", "s7.filhos_virao", "s7.filhos_ficam_com", "s8.pastor_bloco", "s8.tem_ministerio", "s8.ministerio_qual", "s8.ministerio_tempo", "s8.tem_lideranca", "s8.lideranca_cargo", "s8.responsabilidades_igreja", "s9.oculto", "s10.teve_historico", "s10.hist_qual", "s10.hist_org", "s10.hist_duracao", "s10.hist_quando", "s10.hist_lider_nome", "s10.hist_lider_email", "s10.hist_lider_tel", "s11.oculto", "s13.oculto", "s14.oculto"]}'::jsonb,
  'evento' from organizations
on conflict (organization_id, name) do nothing;
