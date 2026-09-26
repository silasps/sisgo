-- Chat institucional (DM 1-a-1) — grupos continuam em ministry_messages/
-- school_messages, só passam a ser listados junto na UI nova (sem migrar
-- dado, ver plano). RLS aqui é defesa em profundidade — autorização real é
-- feita na aplicação (canMessage(), chat-access.ts), mesmo padrão já usado
-- em ministry_messages/ministry_board_cards.

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null default 'dm' check (kind = 'dm'),
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

-- Sempre exatamente 2 linhas por conversa de DM.
create table public.chat_participants (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create index idx_chat_participants_user on public.chat_participants(user_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index idx_chat_messages_conversation on public.chat_messages(conversation_id, created_at desc);

-- Reação rápida numa mensagem ("joinha" etc.) — 1 emoji por pessoa por
-- mensagem; repetir o clique no mesmo emoji remove (toggle), clicar num
-- emoji diferente troca. Ver chat-access.ts/toggleReaction.
create table public.chat_message_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- Política por organização (1 linha por base) — matriz simples de quem
-- pode iniciar DM com quem. Sem linha ainda = valores default abaixo.
create table public.chat_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  aluno_pode_iniciar boolean not null default true,
  aluno_escopo text not null default 'proprio_grupo'
    check (aluno_escopo in ('qualquer_um','proprio_grupo','ninguem')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Moderação pontual: bloquear uma pessoa (não manda mensagem nenhuma na
-- base) ou travar uma conversa específica (read-only pros participantes).
create table public.chat_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  blocked_user_id uuid references auth.users(id) on delete cascade,
  conversation_id uuid references public.chat_conversations(id) on delete cascade,
  reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check ((blocked_user_id is not null) <> (conversation_id is not null))
);
create index idx_chat_blocks_org on public.chat_blocks(organization_id);

alter table public.chat_conversations enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_reactions enable row level security;
alter table public.chat_policies enable row level security;
alter table public.chat_blocks enable row level security;

create policy "chat_conversations - participant select" on public.chat_conversations
  for select using (
    is_superadmin()
    or exists (
      select 1 from public.chat_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );

create policy "chat_participants - own select" on public.chat_participants
  for select using (
    is_superadmin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.chat_participants cp2
      where cp2.conversation_id = conversation_id and cp2.user_id = auth.uid()
    )
  );

create policy "chat_messages - participant select" on public.chat_messages
  for select using (
    is_superadmin()
    or exists (
      select 1 from public.chat_participants cp
      where cp.conversation_id = chat_messages.conversation_id and cp.user_id = auth.uid()
    )
  );

create policy "chat_messages - participant insert" on public.chat_messages
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.chat_participants cp
      where cp.conversation_id = chat_messages.conversation_id and cp.user_id = auth.uid()
    )
  );

create policy "chat_message_reactions - participant select" on public.chat_message_reactions
  for select using (
    is_superadmin()
    or exists (
      select 1 from public.chat_messages m
      join public.chat_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_id and cp.user_id = auth.uid()
    )
  );

create policy "chat_message_reactions - participant write" on public.chat_message_reactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "chat_policies - org select" on public.chat_policies
  for select using (organization_id = auth_organization_id() or is_superadmin());

create policy "chat_blocks - org select" on public.chat_blocks
  for select using (organization_id = auth_organization_id() or is_superadmin());
