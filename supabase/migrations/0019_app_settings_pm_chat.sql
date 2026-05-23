-- Global app settings (admin-controlled feature flags)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('pm_chat_enabled', 'true'::jsonb)
on conflict (key) do nothing;

create or replace function public.pm_chat_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when jsonb_typeof(s.value) = 'boolean' then (s.value #>> '{}')::boolean
        when jsonb_typeof(s.value) = 'string' then lower(s.value #>> '{}') in ('true', '1', 'yes')
        else null
      end
      from public.app_settings s
      where s.key = 'pm_chat_enabled'
    ),
    true
  );
$$;

-- PM role helper (matches is_admin() pattern on public.profiles)
create or replace function public.is_pm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.role::text) = 'pm'
  );
$$;

grant execute on function public.pm_chat_enabled() to authenticated;
grant execute on function public.is_pm() to authenticated;

alter table public.app_settings enable row level security;

drop policy if exists "authenticated read app settings" on public.app_settings;
create policy "authenticated read app settings"
on public.app_settings for select
to authenticated
using (true);

drop policy if exists "admins update app settings" on public.app_settings;
create policy "admins update app settings"
on public.app_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins insert app settings" on public.app_settings;
create policy "admins insert app settings"
on public.app_settings for insert
to authenticated
with check (public.is_admin());

-- PM chat/reply/close only when enabled
drop policy if exists "pm insert replies" on public.query_replies;
create policy "pm insert replies"
on public.query_replies for insert
with check (
  public.is_pm()
  and public.pm_chat_enabled()
  and exists (
    select 1
    from public.queries q
    join public.projects p on p.id = q.project_id
    where q.id = query_replies.query_id
      and p.pm_id = auth.uid()
  )
);

drop policy if exists "pm close queries" on public.queries;
create policy "pm close queries"
on public.queries for update
using (
  public.is_pm()
  and public.pm_chat_enabled()
  and exists (
    select 1 from public.projects p
    where p.id = queries.project_id
      and p.pm_id = auth.uid()
  )
)
with check (
  public.is_pm()
  and public.pm_chat_enabled()
  and exists (
    select 1 from public.projects p
    where p.id = queries.project_id
      and p.pm_id = auth.uid()
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;
