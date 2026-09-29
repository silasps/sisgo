-- ============================================================
-- SISGO — Migration 155: Geral sem opção de sair
-- ============================================================
--
-- O Geral é o grupo institucional da base: toda a equipe ativa fica nele,
-- sem opção de sair (quem não quer ser incomodado silencia — migration
-- 154, chat_participants.muted, que continua valendo). Desfaz a parte de
-- "sair do Geral" da migration 154: a tabela chat_geral_opt_outs nunca
-- chegou a ser usada (vazia quando esta migration foi escrita) e a
-- sincronização volta a considerar só quem é da equipe.

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

drop table if exists public.chat_geral_opt_outs;
