-- ============================================================
-- SISGO — Migration 153: Chat "Geral" da base (grupão com todos)
-- ============================================================
--
-- Uma conversa em grupo por organização (kind = 'geral'), tipo um grupo de
-- WhatsApp com toda a equipe da base. Membros = todo usuário ATIVO da base
-- que não é aluno nem associado (DH/hospitalidade/líderes entram mesmo sem
-- staff_profile). A lista se mantém sozinha: um gatilho em
-- organization_users ressincroniza a base a cada entrada, saída, troca de
-- papel ou desativação — quem sai da base (ou vira aluno) sai do grupo.
-- Sair do grupo remove só a participação (chat_participants), nunca a
-- pessoa nem as mensagens dela.

alter table public.chat_conversations drop constraint if exists chat_conversations_kind_check;
alter table public.chat_conversations add constraint chat_conversations_kind_check
  check (kind in ('dm', 'geral'));

create unique index if not exists chat_conversations_one_geral_per_org
  on public.chat_conversations (organization_id) where kind = 'geral';

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
  on conflict do nothing;

  delete from public.chat_participants cp
   where cp.conversation_id = v_conv
     and not exists (
       select 1
         from public.organization_users ou
         join public.roles r on r.id = ou.role_id
        where ou.organization_id = p_org_id
          and ou.user_id = cp.user_id
          and ou.active
          and r.name not in ('aluno', 'associado')
     );

  return v_conv;
end;
$$;

revoke execute on function public.sync_general_chat(uuid) from public, anon, authenticated;
grant execute on function public.sync_general_chat(uuid) to service_role;

-- Nunca bloqueia a gestão de usuários: se a sincronização falhar, só avisa
-- no log e a alteração em organization_users segue normalmente.
create or replace function public.trg_sync_general_chat()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op = 'DELETE' then
      perform public.sync_general_chat(old.organization_id);
    else
      perform public.sync_general_chat(new.organization_id);
      if tg_op = 'UPDATE' and old.organization_id is distinct from new.organization_id then
        perform public.sync_general_chat(old.organization_id);
      end if;
    end if;
  exception when others then
    raise warning 'sync_general_chat falhou: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists trg_organization_users_sync_general_chat on public.organization_users;
create trigger trg_organization_users_sync_general_chat
  after insert or delete or update of active, role_id, organization_id on public.organization_users
  for each row execute function public.trg_sync_general_chat();

-- Cria o Geral de cada base ativa já com a equipe atual dentro.
select public.sync_general_chat(id) from public.organizations where active;
