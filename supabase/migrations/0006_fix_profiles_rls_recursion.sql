-- Fix infinite recursion: policies on profiles must not subquery profiles directly.
-- Use a SECURITY DEFINER helper so the admin check does not re-enter RLS.

create or replace function public.is_admin()
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
      and lower(p.role::text) = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;

drop policy if exists "admins select all profiles" on public.profiles;
create policy "admins select all profiles"
on public.profiles
for select
using (public.is_admin());

drop policy if exists "admins update roles on profiles" on public.profiles;
create policy "admins update roles on profiles"
on public.profiles
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins select activity logs" on public.activity_logs;
create policy "admins select activity logs"
on public.activity_logs
for select
using (public.is_admin());
