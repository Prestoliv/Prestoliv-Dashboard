-- Milestones RLS: use is_admin() + project membership (not user_has_role on public.users).
-- Adds PM INSERT (original schema only had PM UPDATE).

alter table if exists public.milestones enable row level security;

-- Customers: see milestones for their projects (no recursion into profiles)
drop policy if exists "customers select milestones" on public.milestones;
create policy "customers select milestones"
on public.milestones
for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = milestones.project_id
      and p.customer_id = auth.uid()
  )
);

-- PMs: see milestones for assigned projects
drop policy if exists "pm select milestones" on public.milestones;
create policy "pm select milestones"
on public.milestones
for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = milestones.project_id
      and p.pm_id = auth.uid()
  )
);

-- Admins
drop policy if exists "admins select milestones" on public.milestones;
drop policy if exists "admins manage milestones" on public.milestones;

create policy "admins select milestones"
on public.milestones
for select
using (public.is_admin());

create policy "admins insert milestones"
on public.milestones
for insert
with check (public.is_admin());

create policy "admins update milestones"
on public.milestones
for update
using (public.is_admin())
with check (public.is_admin());

create policy "admins delete milestones"
on public.milestones
for delete
using (public.is_admin());

-- PM: insert milestones for own projects
drop policy if exists "pm insert milestones" on public.milestones;
create policy "pm insert milestones"
on public.milestones
for insert
with check (
  exists (
    select 1
    from public.projects p
    where p.id = milestones.project_id
      and p.pm_id = auth.uid()
  )
);

-- PM: update milestones for own projects
drop policy if exists "pm update milestones" on public.milestones;
create policy "pm update milestones"
on public.milestones
for update
using (
  exists (
    select 1
    from public.projects p
    where p.id = milestones.project_id
      and p.pm_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = milestones.project_id
      and p.pm_id = auth.uid()
  )
);
