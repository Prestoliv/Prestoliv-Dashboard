-- Projects: admin policies must use public.is_admin() (not user_has_role on public.users).

alter table if exists public.projects enable row level security;

drop policy if exists "admins select all projects" on public.projects;
drop policy if exists "admins manage projects" on public.projects;

create policy "admins select all projects"
on public.projects
for select
using (public.is_admin());

create policy "admins insert projects"
on public.projects
for insert
with check (public.is_admin());

create policy "admins update projects"
on public.projects
for update
using (public.is_admin())
with check (public.is_admin());

create policy "admins delete projects"
on public.projects
for delete
using (public.is_admin());
