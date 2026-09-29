-- ============================================================
-- SISGO — Migration 154: Chat — silenciar conversa e sair do Geral
-- ============================================================
--
-- 1. Silenciar (qualquer conversa): conversa silenciada não acende o aviso
--    de "Chat" no menu, aparece com a bolinha cinza na lista e não gera
--    push (conversa 1-a-1; o Geral ainda não tem push nenhum).
--
-- 2. Sair do Geral: o Geral se ressincroniza sozinho a cada mudança em
--    organization_users (migration 153) — sem guardar que a pessoa saiu por
--    conta própria, o gatilho a colocaria de volta na próxima alteração da
--    equipe. chat_geral_opt_outs guarda isso; "Voltar pro Geral" apaga a
--    linha e ressincroniza. É só uma preferência: nenhuma pessoa, mensagem
--    ou inscrição é apagada.

alter table public.chat_participants
  add column if not exists muted boolean not null default false;

create table if not exists public.chat_geral_opt_outs (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.chat_geral_opt_outs enable row level security;

-- Leitura só da própria linha; escrita só pelo service role (server actions).
create policy "chat_geral_opt_outs - own select" on public.chat_geral_opt_outs
  for select using (user_id = auth.uid());

create or replace function public.sync_general_chat(p_org_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_conv uuid;
begin
  if p_org_id is null then
    return null;
  end if;

  select id into v_conv from public.chat_conversations
   where organization_id = p_org_id and kind = 'geral';
  if v_conv is null then
    insert into public.chat_conversations (organization_id, kind)
    values (p_org_id, 'geral')
    on conflict do nothing
    returning id into v_conv;
    if v_conv is null then
      select id into v_conv from public.chat_conversations
       where organization_id = p_org_id and kind = 'geral';
    end if;
  end if;

  insert into public.chat_participants (conversation_id, user_id)
  select distinct v_conv, ou.user_id
    from public.organization_users ou
    join public.roles r on r.id = ou.role_id
   where ou.organization_id = p_org_id
     and ou.active
     and r.name not in ('aluno', 'associado')
     and not exists (
       select 1 from public.chat_geral_opt_outs x
        where x.organization_id = p_org_id and x.user_id = ou.user_id
     )
  on conflict do nothing;

  delete from public.chat_participants cp
   where cp.conversation_id = v_conv
     and (
       exists (
         select 1 from public.chat_geral_opt_outs x
          where x.organization_id = p_org_id and x.user_id = cp.user_id
       )
       or not exists (
         select 1
           from public.organization_users ou
           join public.roles r on r.id = ou.role_id
          where ou.organization_id = p_org_id
            and ou.user_id = cp.user_id
            and ou.active
            and r.name not in ('aluno', 'associado')
       )
     );

  return v_conv;
end;
$$;
