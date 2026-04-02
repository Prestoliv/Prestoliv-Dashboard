-- Admin can list all profiles (PMs/customers) and activity logs.
-- Apply when using public.profiles as the source of truth (public.users may be a view).

alter table if exists public.profiles enable row level security;

drop policy if exists "admins select all profiles" on public.profiles;
create policy "admins select all profiles"
on public.profiles
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "admins update roles on profiles" on public.profiles;
create policy "admins update roles on profiles"
on public.profiles
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

alter table if exists public.activity_logs enable row level security;

drop policy if exists "admins select activity logs" on public.activity_logs;
create policy "admins select activity logs"
on public.activity_logs
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
