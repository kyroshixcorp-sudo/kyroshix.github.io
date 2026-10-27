-- KYROSHIX RELEASES — private direct-message foundation.
-- This migration is NOT applied automatically. Review and run in Supabase SQL Editor
-- only after backend/01-instalar.sql is installed and Firebase third-party auth works.
-- Firebase JWTs are intentionally authorized by public.krs_uid(); do not trust a
-- client-supplied sender UID, and never place a service-role key in browser code.

begin;

create table if not exists public.krs_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct')),
  created_by text not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.krs_conversation_members (
  conversation_id uuid not null references public.krs_conversations(id) on delete cascade,
  user_id text not null references public.krs_profiles(uid) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.krs_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.krs_conversations(id) on delete cascade,
  sender_id text not null references public.krs_profiles(uid) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists krs_chat_members_by_user
  on public.krs_conversation_members(user_id, joined_at desc);
create index if not exists krs_chat_messages_page
  on public.krs_messages(conversation_id, created_at desc, id desc);
create index if not exists krs_chat_conversations_activity
  on public.krs_conversations(last_message_at desc);

alter table public.krs_conversations enable row level security;
alter table public.krs_conversation_members enable row level security;
alter table public.krs_messages enable row level security;

-- RLS helpers are SECURITY DEFINER to avoid recursive membership-table policies.
-- They reveal only a boolean and run with an empty search_path.
create or replace function public.krs_chat_is_member(p_conversation uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.krs_uid() is not null and exists (
    select 1 from public.krs_conversation_members m
    where m.conversation_id = p_conversation and m.user_id = public.krs_uid()
  );
$$;

create or replace function public.krs_chat_direct_exists(p_other_uid text)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select c.id
  from public.krs_conversations c
  where c.kind = 'direct'
    and exists (select 1 from public.krs_conversation_members a where a.conversation_id=c.id and a.user_id=public.krs_uid())
    and exists (select 1 from public.krs_conversation_members b where b.conversation_id=c.id and b.user_id=p_other_uid)
    and (select count(*) from public.krs_conversation_members m where m.conversation_id=c.id)=2
  order by c.created_at
  limit 1;
$$;

revoke all on function public.krs_chat_is_member(uuid) from public;
revoke all on function public.krs_chat_direct_exists(text) from public;
grant execute on function public.krs_chat_is_member(uuid) to anon, authenticated;
grant execute on function public.krs_chat_direct_exists(text) to anon, authenticated;

-- Firebase tokens in this project are mapped to Supabase role anon. RLS still
-- validates the signed, verified Firebase identity through krs_uid().
revoke all on public.krs_conversations, public.krs_conversation_members, public.krs_messages from public;
grant select on public.krs_conversations, public.krs_conversation_members, public.krs_messages to anon, authenticated;
grant insert on public.krs_messages to anon, authenticated;
grant update (last_read_at) on public.krs_conversation_members to anon, authenticated;

drop policy if exists krs_chat_conversation_read on public.krs_conversations;
create policy krs_chat_conversation_read on public.krs_conversations
  for select to anon, authenticated
  using (public.krs_chat_is_member(id));

drop policy if exists krs_chat_member_read on public.krs_conversation_members;
create policy krs_chat_member_read on public.krs_conversation_members
  for select to anon, authenticated
  using (public.krs_chat_is_member(conversation_id));

drop policy if exists krs_chat_member_receipt on public.krs_conversation_members;
create policy krs_chat_member_receipt on public.krs_conversation_members
  for update to anon, authenticated
  using (user_id = public.krs_uid() and public.krs_chat_is_member(conversation_id))
  with check (user_id = public.krs_uid() and public.krs_chat_is_member(conversation_id));

drop policy if exists krs_chat_message_read on public.krs_messages;
create policy krs_chat_message_read on public.krs_messages
  for select to anon, authenticated
  using (public.krs_chat_is_member(conversation_id));

drop policy if exists krs_chat_message_send on public.krs_messages;
create policy krs_chat_message_send on public.krs_messages
  for insert to anon, authenticated
  with check (
    public.krs_uid() is not null
    and sender_id = public.krs_uid()
    and public.krs_chat_is_member(conversation_id)
    and length(trim(body)) between 1 and 4000
  );

-- Starting a direct chat is the only membership-creation path exposed to clients.
-- It creates exactly two members and cannot be used by an unverified identity.
create or replace function public.krs_start_direct_chat(p_other_uid text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  me text := public.krs_uid();
  other_uid text := p_other_uid;
  conversation uuid;
begin
  if me is null then
    raise exception 'Confirme seu e-mail para usar o chat.';
  end if;
  if other_uid is null or length(other_uid) not between 1 and 128 or other_uid = me then
    raise exception 'Destinatário inválido.';
  end if;
  if not exists (select 1 from public.krs_profiles p where p.uid = me)
     or not exists (select 1 from public.krs_profiles p where p.uid = other_uid) then
    raise exception 'Não foi possível iniciar esta conversa.';
  end if;

  conversation := public.krs_chat_direct_exists(other_uid);
  if conversation is not null then return conversation; end if;

  -- Serialize direct-chat creation for this pair to reduce duplicate conversations.
  perform pg_advisory_xact_lock(hashtextextended(least(me,other_uid)||':'||greatest(me,other_uid),0));
  conversation := public.krs_chat_direct_exists(other_uid);
  if conversation is not null then return conversation; end if;

  insert into public.krs_conversations(created_by) values (me) returning id into conversation;
  insert into public.krs_conversation_members(conversation_id,user_id)
    values (conversation,me),(conversation,other_uid);
  return conversation;
end;
$$;

revoke all on function public.krs_start_direct_chat(text) from public;
grant execute on function public.krs_start_direct_chat(text) to anon, authenticated;

-- Clients cannot create conversations or change membership directly.
revoke insert, delete, update on public.krs_conversations from anon, authenticated;
revoke insert, delete on public.krs_conversation_members from anon, authenticated;

commit;
