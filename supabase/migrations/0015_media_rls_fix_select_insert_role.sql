-- Fix media RLS so admins/PMs can see media they uploaded.
-- Current policies rely on role helpers that may not match the actual stored role or may fail type inference.
-- We instead authorize by project membership and by public.users.role.

-- SELECT policies
drop policy if exists "customers select media" on public.media;
drop policy if exists "pm select media" on public.media;
drop policy if exists "admins select media" on public.media;

create policy "customers select media"
on public.media for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = media.project_id
      and p.customer_id = auth.uid()
  )
);

create policy "pm select media"
on public.media for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = media.project_id
      and p.pm_id = auth.uid()
  )
);

create policy "admins select media"
on public.media for select
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

-- INSERT policies
drop policy if exists "pm insert media row" on public.media;
drop policy if exists "admins insert media row" on public.media;
drop policy if exists "members insert media for their own updates" on public.media;

create policy "members insert media for their own updates"
on public.media for insert
with check (
  exists (
    select 1
    from public.updates u
    where u.id = media.update_id
      and u.created_by = auth.uid()
  )
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('pm','admin')
  )
);

-- DELETE policy already exists in storage.objects, but keep table delete restricted to admins.
drop policy if exists "admins manage media" on public.media;

create policy "admins manage media"
on public.media for delete
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

