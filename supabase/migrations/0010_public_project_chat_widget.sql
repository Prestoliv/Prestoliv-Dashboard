-- Public Project Chat Widget (Webflow embed)
-- Provides SECURITY DEFINER RPC functions so anonymous users can:
-- - resolve a chat token -> project + PM info
-- - list messages for that token
-- - post a new message for that token
--
-- This avoids exposing tables directly via RLS for anon users.

create extension if not exists pgcrypto;

create table if not exists public.project_chat_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists project_chat_tokens_project_id_idx on public.project_chat_tokens(project_id);

create table if not exists public.project_chat_messages (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.project_chat_tokens(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  sender_name text not null,
  sender_email text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists project_chat_messages_token_id_idx on public.project_chat_messages(token_id);
create index if not exists project_chat_messages_project_id_idx on public.project_chat_messages(project_id);
create index if not exists project_chat_messages_created_at_idx on public.project_chat_messages(created_at);

alter table public.project_chat_tokens enable row level security;
alter table public.project_chat_messages enable row level security;

-- No direct table access for anon/authenticated; only via RPC.
revoke all on table public.project_chat_tokens from anon, authenticated;
revoke all on table public.project_chat_messages from anon, authenticated;

-- Helper: validate token and return token row
create or replace function public._get_chat_token(p_token text)
returns public.project_chat_tokens
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t public.project_chat_tokens;
begin
  select * into t
  from public.project_chat_tokens
  where token = p_token
  limit 1;

  if t.id is null then
    raise exception 'Invalid chat token';
  end if;

  if t.expires_at is not null and t.expires_at < now() then
    raise exception 'Chat token expired';
  end if;

  return t;
end;
$$;

-- RPC: resolve token -> context
create or replace function public.get_project_chat_context(p_token text)
returns table (
  token_id uuid,
  project_id uuid,
  project_name text,
  pm_id uuid,
  pm_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select (public._get_chat_token(p_token)).*
  )
  select
    t.id as token_id,
    p.id as project_id,
    p.name as project_name,
    p.pm_id as pm_id,
    coalesce(pm.name, pm.full_name) as pm_name
  from t
  join public.projects p on p.id = t.project_id
  left join public.profiles pm on pm.id = p.pm_id;
$$;

-- RPC: list messages
create or replace function public.list_project_chat_messages(p_token text, p_limit int default 50)
returns table (
  id uuid,
  created_at timestamptz,
  sender_name text,
  sender_email text,
  message text
)
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select (public._get_chat_token(p_token)).*
  )
  select m.id, m.created_at, m.sender_name, m.sender_email, m.message
  from public.project_chat_messages m
  join t on t.id = m.token_id
  order by m.created_at asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

-- RPC: send message
create or replace function public.send_project_chat_message(
  p_token text,
  p_sender_name text,
  p_sender_email text,
  p_message text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  t public.project_chat_tokens;
  new_id uuid;
begin
  if p_sender_name is null or length(trim(p_sender_name)) < 2 then
    raise exception 'Sender name required';
  end if;

  if p_message is null or length(trim(p_message)) < 1 then
    raise exception 'Message required';
  end if;

  t := public._get_chat_token(p_token);

  insert into public.project_chat_messages (token_id, project_id, sender_name, sender_email, message)
  values (t.id, t.project_id, trim(p_sender_name), nullif(trim(p_sender_email), ''), trim(p_message))
  returning id into new_id;

  return new_id;
end;
$$;

-- Admin/PM helper: create token for a project (requires being logged in and admin/pm via profiles role)
create or replace function public.create_project_chat_token(p_project_id uuid, p_expires_at timestamptz default null)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r text;
  my_role text;
begin
  select lower(coalesce(role::text, '')) into my_role
  from public.profiles
  where id = auth.uid();

  if my_role not in ('admin','pm') then
    raise exception 'Not allowed';
  end if;

  r := encode(gen_random_bytes(24), 'hex');

  insert into public.project_chat_tokens (project_id, token, expires_at)
  values (p_project_id, r, p_expires_at);

  return r;
end;
$$;

grant execute on function public.get_project_chat_context(text) to anon, authenticated;
grant execute on function public.list_project_chat_messages(text, int) to anon, authenticated;
grant execute on function public.send_project_chat_message(text, text, text, text) to anon, authenticated;
grant execute on function public.create_project_chat_token(uuid, timestamptz) to authenticated;

